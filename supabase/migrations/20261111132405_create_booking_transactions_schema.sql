CREATE TYPE public.booking_status AS ENUM (
    'pending_payment', 'confirmed', 'cancelled', 'rescheduled'
);

ALTER TABLE public.consultations
    ADD COLUMN booking_status public.booking_status NOT NULL DEFAULT 'pending_payment',
    ADD COLUMN slot_id UUID REFERENCES public.consultation_slots(id) ON DELETE SET NULL,
    ADD COLUMN intake_id UUID REFERENCES public.patient_intake_forms(id) ON DELETE SET NULL,
    ADD COLUMN payment_order_id TEXT,
    ADD COLUMN amount_inr NUMERIC(10,2) NOT NULL DEFAULT 0.00;

CREATE TABLE public.razorpay_order_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id TEXT UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount_paise BIGINT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'created',
    entity_type TEXT NOT NULL CHECK (entity_type IN ('consultation', 'program', 'shop_order')),
    entity_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.razorpay_order_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their Razorpay order logs" ON public.razorpay_order_logs
    FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
GRANT SELECT ON public.razorpay_order_logs TO authenticated;

-- Disable the earlier direct-booking path so bookings cannot bypass payment initiation.
REVOKE ALL ON FUNCTION public.book_consultation_slot(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.initiate_consultation_booking(
    p_slot_id UUID,
    p_patient_id UUID,
    p_chief_complaint TEXT,
    p_fee NUMERIC
)
RETURNS TABLE (consultation_row public.consultations, order_id TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_slot public.consultation_slots;
    v_consultation public.consultations;
    v_order_id TEXT;
BEGIN
    IF auth.uid() IS DISTINCT FROM p_patient_id THEN
        RAISE EXCEPTION 'Patient ID must match the authenticated user';
    END IF;
    IF p_fee IS NULL OR p_fee < 0 THEN
        RAISE EXCEPTION 'Consultation fee must be non-negative';
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

    v_order_id := 'order_mock_' || substr(md5(random()::TEXT), 1, 14);

    INSERT INTO public.consultations (
        patient_id, doctor_id, slot_start, slot_end, status, chief_complaint,
        booking_status, slot_id, payment_order_id, amount_inr
    )
    VALUES (
        p_patient_id, v_slot.practitioner_id, v_slot.start_time, v_slot.end_time,
        'scheduled', p_chief_complaint, 'pending_payment', p_slot_id,
        v_order_id, p_fee
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
        v_order_id, p_patient_id, round(p_fee * 100)::BIGINT, 'INR', 'created',
        'consultation', v_consultation.id
    );

    RETURN QUERY SELECT v_consultation, v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.initiate_consultation_booking(UUID, UUID, TEXT, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.initiate_consultation_booking(UUID, UUID, TEXT, NUMERIC) TO authenticated;
