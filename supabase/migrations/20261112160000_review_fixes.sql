-- Review fixes.

-- 1. Consultation fee comes from the practitioner's profile, never from the client.
--    The total (fee plus 18% GST, in paise) is computed here and returned to the client.
DROP FUNCTION IF EXISTS public.initiate_consultation_booking(UUID, UUID, TEXT, NUMERIC);

CREATE OR REPLACE FUNCTION public.initiate_consultation_booking(
    p_slot_id UUID,
    p_patient_id UUID,
    p_chief_complaint TEXT
)
RETURNS TABLE (consultation_row public.consultations, order_id TEXT, total_paise BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_slot public.consultation_slots;
    v_fee_inr NUMERIC(10, 2);
    v_fee_paise BIGINT;
    v_total_paise BIGINT;
    v_consultation public.consultations;
    v_order_id TEXT;
BEGIN
    IF auth.uid() IS DISTINCT FROM p_patient_id THEN
        RAISE EXCEPTION 'Patient ID must match the authenticated user';
    END IF;
    IF p_chief_complaint IS NULL OR btrim(p_chief_complaint) = '' THEN
        RAISE EXCEPTION 'Chief complaint is required';
    END IF;

    SELECT * INTO v_slot
    FROM public.consultation_slots
    WHERE id = p_slot_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Consultation slot not found';
    END IF;
    IF v_slot.is_booked THEN
        RAISE EXCEPTION 'Consultation slot is already held or booked';
    END IF;
    IF v_slot.start_time <= NOW() THEN
        RAISE EXCEPTION 'Consultation slot must be in the future';
    END IF;

    SELECT pd.consultation_fee_inr INTO v_fee_inr
    FROM public.practitioner_details AS pd
    WHERE pd.id = v_slot.practitioner_id AND pd.is_active;
    IF NOT FOUND OR v_fee_inr IS NULL THEN
        RAISE EXCEPTION 'Practitioner is not accepting consultations';
    END IF;

    v_fee_paise := round(v_fee_inr * 100)::BIGINT;
    v_total_paise := v_fee_paise + round(v_fee_paise * 0.18)::BIGINT;
    v_order_id := 'order_mock_' || substr(md5(random()::TEXT), 1, 14);

    INSERT INTO public.consultations (
        patient_id, doctor_id, slot_start, slot_end, status, chief_complaint,
        booking_status, slot_id, payment_order_id, amount_inr
    )
    VALUES (
        p_patient_id, v_slot.practitioner_id, v_slot.start_time, v_slot.end_time,
        'scheduled', p_chief_complaint, 'pending_payment', p_slot_id,
        v_order_id, v_total_paise / 100.0
    )
    RETURNING * INTO v_consultation;

    UPDATE public.consultation_slots
    SET is_booked = TRUE, consultation_id = v_consultation.id
    WHERE id = p_slot_id AND NOT is_booked;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Consultation slot is already held or booked';
    END IF;

    INSERT INTO public.razorpay_order_logs (
        order_id, user_id, amount_paise, currency, status, entity_type, entity_id
    )
    VALUES (
        v_order_id, p_patient_id, v_total_paise, 'INR', 'created',
        'consultation', v_consultation.id
    );

    RETURN QUERY SELECT v_consultation, v_order_id, v_total_paise;
END;
$$;

REVOKE ALL ON FUNCTION public.initiate_consultation_booking(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.initiate_consultation_booking(UUID, UUID, TEXT) TO authenticated;

-- 2. A patient can hold only one active enrolment per program. Concurrent duplicate
--    deliveries of one payment now fail on this index, and the webhook treats that as done.
CREATE UNIQUE INDEX IF NOT EXISTS program_enrolments_one_active_per_program
    ON public.program_enrolments (patient_id, program_id)
    WHERE status = 'active';

-- 3. Signing a prescription never completes a cancelled consultation.
CREATE OR REPLACE FUNCTION public.complete_consultation_after_prescription()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM set_config('healthoraa.prescription_completion', 'on', true);

    UPDATE public.consultations
    SET status = 'completed',
        followup_expires_at = NOW() + (NEW.followup_days || ' days')::INTERVAL
    WHERE id = NEW.consultation_id
      AND doctor_id = NEW.doctor_id
      AND patient_id = NEW.patient_id
      AND status <> 'cancelled';

    PERFORM set_config('healthoraa.prescription_completion', 'off', true);
    RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Practitioners create prescriptions for own consultations" ON public.prescriptions;
CREATE POLICY "Practitioners create prescriptions for own consultations" ON public.prescriptions
    FOR INSERT TO authenticated
    WITH CHECK (doctor_id = (SELECT auth.uid()) AND public.current_user_role() = 'practitioner'
        AND EXISTS (SELECT 1 FROM public.consultations c
            WHERE c.id = prescriptions.consultation_id AND c.doctor_id = (SELECT auth.uid())
              AND c.patient_id = prescriptions.patient_id
              AND c.status <> 'cancelled'));

-- 4. Medicine lines and follow-up windows are checked in the database too.
ALTER TABLE public.prescription_medicines
    ADD CONSTRAINT prescription_medicines_name_present CHECK (length(btrim(name)) > 0),
    ADD CONSTRAINT prescription_medicines_dosage_present CHECK (length(btrim(dosage)) > 0),
    ADD CONSTRAINT prescription_medicines_frequency_present CHECK (length(btrim(frequency)) > 0),
    ADD CONSTRAINT prescription_medicines_duration_range CHECK (duration_days BETWEEN 1 AND 180);

ALTER TABLE public.prescriptions
    ADD CONSTRAINT prescriptions_followup_days_range CHECK (followup_days BETWEEN 0 AND 60);

-- 5. Indexes for the columns that row-level security and the queues filter on.
CREATE INDEX IF NOT EXISTS consultations_patient_id_idx ON public.consultations (patient_id);
CREATE INDEX IF NOT EXISTS consultations_doctor_slot_idx ON public.consultations (doctor_id, slot_start);
CREATE INDEX IF NOT EXISTS consultation_messages_thread_idx ON public.consultation_messages (consultation_id, created_at);
CREATE INDEX IF NOT EXISTS prescriptions_consultation_id_idx ON public.prescriptions (consultation_id);
CREATE INDEX IF NOT EXISTS prescriptions_patient_id_idx ON public.prescriptions (patient_id);
CREATE INDEX IF NOT EXISTS prescription_medicines_prescription_id_idx ON public.prescription_medicines (prescription_id);
CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON public.orders (customer_id);

-- 6. Publishing the schedule is one transaction: duration, weekly rules, open-slot clearing
--    and slot generation. A bad rule rolls back everything, so the old schedule stays.
CREATE OR REPLACE FUNCTION public.publish_schedule(
    p_duration_minutes INT,
    p_rules JSONB,
    p_days INT DEFAULT 7
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_practitioner UUID := (SELECT auth.uid());
    v_today DATE := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;
    v_from TIMESTAMPTZ := NOW();
    v_to TIMESTAMPTZ := NOW() + make_interval(days => p_days);
    v_created INT := 0;
    v_offset INT;
BEGIN
    IF public.current_user_role() IS DISTINCT FROM 'practitioner' THEN
        RAISE EXCEPTION 'Only practitioners can publish a schedule';
    END IF;
    IF p_duration_minutes IS NULL OR p_duration_minutes NOT BETWEEN 15 AND 60 THEN
        RAISE EXCEPTION 'Slot length must be between 15 and 60 minutes';
    END IF;
    IF p_days IS NULL OR p_days NOT BETWEEN 1 AND 31 THEN
        RAISE EXCEPTION 'Publish window must be between 1 and 31 days';
    END IF;
    IF jsonb_typeof(p_rules) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Weekly rules must be a list';
    END IF;

    UPDATE public.practitioner_details
    SET slot_duration_minutes = p_duration_minutes
    WHERE id = v_practitioner;

    DELETE FROM public.practitioner_availability_rules
    WHERE practitioner_id = v_practitioner;

    INSERT INTO public.practitioner_availability_rules (
        practitioner_id, day_of_week, start_time, end_time, is_active
    )
    SELECT v_practitioner,
           (r ->> 'day_of_week')::INT,
           (r ->> 'start_time')::TIME,
           (r ->> 'end_time')::TIME,
           COALESCE((r ->> 'is_active')::BOOLEAN, TRUE)
    FROM jsonb_array_elements(p_rules) AS r;

    -- Open future slots are replaced. Booked slots are never touched.
    DELETE FROM public.consultation_slots
    WHERE practitioner_id = v_practitioner
      AND NOT is_booked
      AND start_time >= v_from
      AND start_time < v_to;

    FOR v_offset IN 0..p_days - 1 LOOP
        v_created := v_created + public.generate_consultation_slots(v_practitioner, v_today + v_offset);
    END LOOP;

    RETURN v_created;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_schedule(INT, JSONB, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_schedule(INT, JSONB, INT) TO authenticated;
