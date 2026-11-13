-- Follow-ups from the CodeRabbit review of 20261112160000.

-- The booking RPC's fee and GST return values come from 20261113082049, applied before this file.

-- 1. Publishing clears open slots only up to midnight IST at the end of the window,
--    matching the dates the generator creates. Slots on the day after the window stay.
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
    v_to TIMESTAMPTZ := timezone('Asia/Kolkata', (v_today + p_days)::TIMESTAMP);
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

-- 2. The CHECK constraints from 20261112160000 are re-added without scanning existing rows.
--    They apply to every new write at once. 20261112171000 validates the existing rows
--    in its own transaction, so the table is not locked for the scan.
ALTER TABLE public.prescription_medicines
    DROP CONSTRAINT prescription_medicines_name_present,
    DROP CONSTRAINT prescription_medicines_dosage_present,
    DROP CONSTRAINT prescription_medicines_frequency_present,
    DROP CONSTRAINT prescription_medicines_duration_range,
    ADD CONSTRAINT prescription_medicines_name_present CHECK (length(btrim(name)) > 0) NOT VALID,
    ADD CONSTRAINT prescription_medicines_dosage_present CHECK (length(btrim(dosage)) > 0) NOT VALID,
    ADD CONSTRAINT prescription_medicines_frequency_present CHECK (length(btrim(frequency)) > 0) NOT VALID,
    ADD CONSTRAINT prescription_medicines_duration_range CHECK (duration_days BETWEEN 1 AND 180) NOT VALID;

ALTER TABLE public.prescriptions
    DROP CONSTRAINT prescriptions_followup_days_range,
    ADD CONSTRAINT prescriptions_followup_days_range CHECK (followup_days BETWEEN 0 AND 60) NOT VALID;
