-- The booking receipt must use the same fee snapshot that was charged by the server.
-- PostgreSQL cannot change a table-returning function's return type with CREATE OR REPLACE.
DROP FUNCTION public.initiate_consultation_booking(UUID, UUID, TEXT);

CREATE FUNCTION public.initiate_consultation_booking(
    p_slot_id UUID,
    p_patient_id UUID,
    p_chief_complaint TEXT
)
RETURNS TABLE (
    consultation_row public.consultations,
    order_id TEXT,
    fee_paise BIGINT,
    gst_paise BIGINT,
    total_paise BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_slot public.consultation_slots;
    v_fee_inr NUMERIC(10, 2);
    v_fee_paise BIGINT;
    v_gst_paise BIGINT;
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
    v_gst_paise := round(v_fee_paise * 0.18)::BIGINT;
    v_total_paise := v_fee_paise + v_gst_paise;
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

    RETURN QUERY SELECT v_consultation, v_order_id, v_fee_paise, v_gst_paise, v_total_paise;
END;
$$;

REVOKE ALL ON FUNCTION public.initiate_consultation_booking(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.initiate_consultation_booking(UUID, UUID, TEXT) TO authenticated;
