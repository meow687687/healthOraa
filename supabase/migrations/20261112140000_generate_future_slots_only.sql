-- Generates only future slots. Earlier windows on today's date were created as past rows,
-- which inflated the published count without being bookable.

CREATE OR REPLACE FUNCTION public.generate_consultation_slots(
    p_practitioner_id UUID,
    p_date DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_duration_minutes INT;
    v_inserted_count INT;
BEGIN
    IF auth.uid() IS DISTINCT FROM p_practitioner_id THEN
        RAISE EXCEPTION 'Only the practitioner can generate their consultation slots';
    END IF;

    SELECT slot_duration_minutes INTO v_duration_minutes
    FROM public.practitioner_details
    WHERE id = p_practitioner_id;

    IF NOT FOUND OR v_duration_minutes <= 0 THEN
        RAISE EXCEPTION 'Practitioner not found or has an invalid slot duration';
    END IF;

    INSERT INTO public.consultation_slots (practitioner_id, start_time, end_time)
    SELECT p_practitioner_id,
           slot_start AT TIME ZONE 'Asia/Kolkata',
           (slot_start + make_interval(mins => v_duration_minutes)) AT TIME ZONE 'Asia/Kolkata'
    FROM public.practitioner_availability_rules AS rule
    CROSS JOIN LATERAL generate_series(
        p_date::TIMESTAMP + rule.start_time,
        p_date::TIMESTAMP + rule.end_time - make_interval(mins => v_duration_minutes),
        make_interval(mins => v_duration_minutes)
    ) AS slot_start
    WHERE rule.practitioner_id = p_practitioner_id
      AND rule.day_of_week = EXTRACT(DOW FROM p_date)::INT
      AND rule.is_active
      -- Past windows are not bookable, so do not create them (today's earlier windows).
      AND (slot_start AT TIME ZONE 'Asia/Kolkata') > NOW()
    ON CONFLICT (practitioner_id, start_time) DO NOTHING;

    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
    RETURN v_inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_consultation_slots(UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_consultation_slots(UUID, DATE) TO authenticated;
