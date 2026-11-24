-- Keep the prescription trigger's narrowly scoped completion update compatible with the
-- fail-closed write guard, and anchor consultation chat to the PRD's seven days after slot end.
CREATE OR REPLACE FUNCTION public.complete_consultation_after_prescription()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    PERFORM set_config('healthoraa.prescription_completion', 'on', true);

    UPDATE public.consultations AS consultation
    SET status = 'completed',
        followup_expires_at = consultation.slot_end + INTERVAL '7 days'
    WHERE consultation.id = NEW.consultation_id
      AND consultation.doctor_id = NEW.doctor_id
      AND consultation.patient_id = NEW.patient_id
      AND consultation.booking_status = 'confirmed'
      AND consultation.status IN ('in_progress', 'completed');

    IF NOT FOUND THEN
        PERFORM set_config('healthoraa.prescription_completion', 'off', true);
        RAISE EXCEPTION 'Consultation is not eligible for prescription completion';
    END IF;

    PERFORM set_config('healthoraa.prescription_completion', 'off', true);
    RETURN NEW;
END;
$$;

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
               AND OLD.booking_status = 'pending_payment' AND OLD.payment_expires_at <= NOW()
               AND NEW.booking_status = 'cancelled' AND NEW.status = 'cancelled'
               AND (to_jsonb(NEW) - ARRAY['status', 'booking_status']) IS NOT DISTINCT FROM
                   (to_jsonb(OLD) - ARRAY['status', 'booking_status']) THEN
                RETURN NEW;
            END IF;

            -- The prescription trigger sets this transaction-local flag after the assigned
            -- practitioner writes a prescription. Keep the update limited to completion and
            -- the exact seven-day cutoff derived from the booked slot.
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

-- Earlier trigger versions used the clinician's prescription review interval as the chat
-- cutoff. Correct existing signed consultations so the PRD's seven-day window is enforced
-- for records already in the database as well as new prescriptions.
UPDATE public.consultations AS consultation
SET followup_expires_at = consultation.slot_end + INTERVAL '7 days'
WHERE consultation.status = 'completed'
  AND consultation.slot_end IS NOT NULL
  AND consultation.followup_expires_at IS DISTINCT FROM consultation.slot_end + INTERVAL '7 days'
  AND EXISTS (
      SELECT 1
      FROM public.prescriptions AS prescription
      WHERE prescription.consultation_id = consultation.id
  );

REVOKE ALL ON FUNCTION public.complete_consultation_after_prescription() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_rbac_write() FROM PUBLIC, anon, authenticated;
