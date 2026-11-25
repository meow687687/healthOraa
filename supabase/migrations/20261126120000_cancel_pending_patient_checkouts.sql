-- Let a patient stop a pending booking or shop order and release its local reservation atomically.
-- Keep Razorpay order-log writes out of these transactions: capture webhooks lock that row before
-- confirming the consultation/order, so touching it here could invert the lock order.
CREATE OR REPLACE FUNCTION public.enforce_rbac_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_role public.user_role;
BEGIN
    IF (SELECT auth.uid()) IS NULL THEN RETURN NEW; END IF;
    v_role := public.current_user_role();
    IF v_role = 'admin' THEN RETURN NEW; END IF;

    IF TG_TABLE_NAME = 'practitioner_details' THEN
        IF v_role IS DISTINCT FROM 'practitioner' OR NEW.id IS DISTINCT FROM (SELECT auth.uid()) THEN
            RAISE EXCEPTION 'Only practitioners may update their own details';
        END IF;
    ELSIF TG_TABLE_NAME = 'consultations' THEN
        IF TG_OP = 'UPDATE' THEN
            IF v_role = 'patient' AND OLD.patient_id = (SELECT auth.uid())
               AND OLD.booking_status = 'pending_payment' AND NEW.booking_status = 'cancelled'
               AND NEW.status = 'cancelled'
               AND (current_setting('healthoraa.pending_booking_cancellation', true) = 'on'
                    OR OLD.payment_expires_at <= NOW())
               AND (to_jsonb(NEW) - ARRAY['status', 'booking_status']) IS NOT DISTINCT FROM
                   (to_jsonb(OLD) - ARRAY['status', 'booking_status']) THEN
                RETURN NEW;
            END IF;
            IF current_setting('healthoraa.prescription_completion', true) = 'on' THEN
                IF v_role IS DISTINCT FROM 'practitioner'
                   OR OLD.doctor_id IS DISTINCT FROM (SELECT auth.uid())
                   OR NEW.doctor_id IS DISTINCT FROM OLD.doctor_id
                   OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
                   OR OLD.booking_status IS DISTINCT FROM 'confirmed'
                   OR NEW.booking_status IS DISTINCT FROM OLD.booking_status
                   OR OLD.status NOT IN ('in_progress', 'completed')
                   OR NEW.status IS DISTINCT FROM 'completed'
                   OR (to_jsonb(NEW) - ARRAY['status', 'followup_expires_at']) IS DISTINCT FROM
                      (to_jsonb(OLD) - ARRAY['status', 'followup_expires_at'])
                   OR NEW.followup_expires_at IS DISTINCT FROM OLD.slot_end + INTERVAL '7 days' THEN
                    RAISE EXCEPTION 'Prescription completion update is not authorized';
                END IF;
                RETURN NEW;
            END IF;
            IF v_role IS DISTINCT FROM 'practitioner'
               OR OLD.doctor_id IS DISTINCT FROM (SELECT auth.uid())
               OR NEW.doctor_id IS DISTINCT FROM OLD.doctor_id
               OR OLD.booking_status IS DISTINCT FROM 'confirmed'
               OR NEW.booking_status IS DISTINCT FROM 'confirmed'
               OR OLD.status IS DISTINCT FROM 'scheduled'
               OR NEW.status IS DISTINCT FROM 'in_progress'
               OR (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') THEN
                RAISE EXCEPTION 'Practitioners may only start confirmed consultations';
            END IF;
            RETURN NEW;
        END IF;
        IF v_role IS DISTINCT FROM 'patient' OR NEW.patient_id IS DISTINCT FROM (SELECT auth.uid()) THEN
            RAISE EXCEPTION 'Only patients may initiate their own consultations';
        END IF;
    ELSIF TG_TABLE_NAME = 'orders' THEN
        IF v_role IS DISTINCT FROM 'patient' OR NEW.customer_id IS DISTINCT FROM (SELECT auth.uid()) THEN
            RAISE EXCEPTION 'Only active patients may place their own orders';
        END IF;
    ELSIF TG_TABLE_NAME = 'program_progress_logs' THEN
        IF TG_OP = 'UPDATE' AND v_role = 'practitioner'
           AND (to_jsonb(NEW) - 'dietitian_feedback') IS NOT DISTINCT FROM
               (to_jsonb(OLD) - 'dietitian_feedback') THEN
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'Practitioners may only update assigned feedback';
    ELSIF TG_TABLE_NAME = 'consultation_slots' THEN
        IF v_role = 'practitioner' AND NEW.practitioner_id = (SELECT auth.uid())
           AND (TG_OP = 'INSERT' OR (NOT OLD.is_booked AND NOT NEW.is_booked
             AND NEW.consultation_id IS NOT DISTINCT FROM OLD.consultation_id)) THEN
            RETURN NEW;
        END IF;
        IF v_role = 'patient' AND TG_OP = 'UPDATE' AND OLD.is_booked AND NOT NEW.is_booked
           AND NEW.consultation_id IS NULL
           AND current_setting('healthoraa.pending_booking_cancellation', true) = 'on'
           AND EXISTS (SELECT 1 FROM public.consultations c
               WHERE c.id = OLD.consultation_id AND c.patient_id = (SELECT auth.uid())
                 AND c.booking_status = 'cancelled') THEN
            RETURN NEW;
        END IF;
        IF v_role = 'patient' AND TG_OP = 'UPDATE' AND OLD.is_booked AND NOT NEW.is_booked
           AND NEW.consultation_id IS NULL
           AND EXISTS (SELECT 1 FROM public.consultations c
               WHERE c.id = OLD.consultation_id AND c.patient_id = (SELECT auth.uid())
                 AND c.booking_status = 'cancelled' AND c.payment_expires_at <= NOW()) THEN
            RETURN NEW;
        END IF;
        IF v_role = 'patient' AND TG_OP = 'UPDATE' AND NOT OLD.is_booked AND NEW.is_booked
           AND EXISTS (SELECT 1 FROM public.consultations c
               WHERE c.id = NEW.consultation_id AND c.slot_id = OLD.id
                 AND c.patient_id = (SELECT auth.uid())
                 AND c.booking_status = 'pending_payment') THEN
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'Not authorized to change this consultation slot';
    ELSE
        RAISE EXCEPTION 'Not authorized to write %', TG_TABLE_NAME;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_pending_consultation_booking(p_consultation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_patient_id UUID := auth.uid();
    v_booking_status public.booking_status;
    v_slot_id UUID;
BEGIN
    IF v_patient_id IS NULL OR public.current_user_role() IS DISTINCT FROM 'patient'::public.user_role THEN
        RETURN FALSE;
    END IF;

    SELECT consultation.booking_status, consultation.slot_id
    INTO v_booking_status, v_slot_id
    FROM public.consultations AS consultation
    WHERE consultation.id = p_consultation_id
      AND consultation.patient_id = v_patient_id
    FOR UPDATE;
    IF NOT FOUND THEN RETURN FALSE; END IF;
    IF v_booking_status = 'cancelled'::public.booking_status THEN RETURN TRUE; END IF;
    IF v_booking_status IS DISTINCT FROM 'pending_payment'::public.booking_status THEN RETURN FALSE; END IF;

    PERFORM pg_catalog.set_config('healthoraa.pending_booking_cancellation', 'on', TRUE);
    UPDATE public.consultations
    SET booking_status = 'cancelled'::public.booking_status,
        status = 'cancelled'::public.consultation_status
    WHERE id = p_consultation_id
      AND patient_id = v_patient_id
      AND booking_status = 'pending_payment'::public.booking_status;
    IF NOT FOUND THEN
        PERFORM pg_catalog.set_config('healthoraa.pending_booking_cancellation', 'off', TRUE);
        RETURN FALSE;
    END IF;

    IF v_slot_id IS NOT NULL THEN
        UPDATE public.consultation_slots
        SET is_booked = FALSE, consultation_id = NULL
        WHERE id = v_slot_id AND consultation_id = p_consultation_id;
    END IF;

    PERFORM pg_catalog.set_config('healthoraa.pending_booking_cancellation', 'off', TRUE);
    RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_pending_consultation_booking(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_pending_consultation_booking(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_pending_shop_order(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_patient_id UUID := auth.uid();
    v_order_status public.order_status;
    v_stock_released_at TIMESTAMPTZ;
BEGIN
    IF v_patient_id IS NULL OR public.current_user_role() IS DISTINCT FROM 'patient'::public.user_role THEN
        RETURN FALSE;
    END IF;

    SELECT shop_order.status, shop_order.stock_released_at
    INTO v_order_status, v_stock_released_at
    FROM public.orders AS shop_order
    WHERE shop_order.id = p_order_id
      AND shop_order.customer_id = v_patient_id
    FOR UPDATE;
    IF NOT FOUND THEN RETURN FALSE; END IF;
    IF v_order_status = 'cancelled'::public.order_status THEN RETURN TRUE; END IF;
    IF v_order_status IS DISTINCT FROM 'pending'::public.order_status OR v_stock_released_at IS NOT NULL THEN
        RETURN FALSE;
    END IF;

    UPDATE public.orders
    SET status = 'cancelled'::public.order_status
    WHERE id = p_order_id
      AND customer_id = v_patient_id
      AND status = 'pending'::public.order_status
      AND stock_released_at IS NULL;
    RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_pending_shop_order(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_pending_shop_order(UUID) TO authenticated;
