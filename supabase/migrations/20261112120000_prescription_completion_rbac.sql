-- Signing a prescription completes its consultation and opens the 7-day follow-up
-- window. The trigger runs inside the practitioner's own write, so the status-only
-- rule in enforce_rbac_write would reject the follow-up timestamp. The trigger sets a
-- transaction-local flag, and only it can set that flag, so the exemption is narrow.

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
      AND patient_id = NEW.patient_id;

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
    IF (SELECT auth.uid()) IS NULL THEN
        RETURN NEW;
    END IF;
    v_role := public.current_user_role();
    IF v_role = 'admin' THEN
        RETURN NEW;
    END IF;

    IF TG_TABLE_NAME = 'practitioner_details' THEN
        IF v_role <> 'practitioner' OR NEW.id <> (SELECT auth.uid()) THEN
            RAISE EXCEPTION 'Only practitioners may update their own details';
        END IF;
    ELSIF TG_TABLE_NAME = 'consultations' THEN
        IF TG_OP = 'UPDATE' THEN
            -- Set only by complete_consultation_after_prescription, for this transaction.
            IF current_setting('healthoraa.prescription_completion', true) = 'on' THEN
                RETURN NEW;
            END IF;
            IF v_role <> 'practitioner' OR OLD.doctor_id <> (SELECT auth.uid())
               OR NEW.doctor_id <> OLD.doctor_id
               OR (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') THEN
                RAISE EXCEPTION 'Practitioners may only update status on their own consultations';
            END IF;
            RETURN NEW;
        END IF;
        IF v_role <> 'patient' OR NEW.patient_id <> (SELECT auth.uid()) THEN
            RAISE EXCEPTION 'Only patients may initiate their own consultations';
        END IF;
    ELSIF TG_TABLE_NAME = 'orders' THEN
        IF v_role <> 'patient' OR NEW.customer_id <> (SELECT auth.uid()) THEN
            RAISE EXCEPTION 'Only patients may place their own orders';
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

