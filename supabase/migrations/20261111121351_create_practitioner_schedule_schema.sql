-- Development-only table policies; replace with practitioner/patient scoped rules before deployment.
ALTER TABLE public.consultations ADD COLUMN chief_complaint TEXT;

CREATE TABLE public.practitioner_availability_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    practitioner_id UUID NOT NULL REFERENCES public.practitioner_details(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (start_time < end_time)
);

CREATE TABLE public.consultation_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    practitioner_id UUID NOT NULL REFERENCES public.practitioner_details(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_booked BOOLEAN NOT NULL DEFAULT FALSE,
    consultation_id UUID REFERENCES public.consultations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (practitioner_id, start_time),
    CHECK (end_time > start_time)
);

ALTER TABLE public.practitioner_availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Development read and write availability rules" ON public.practitioner_availability_rules
    FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Development read and write consultation slots" ON public.consultation_slots
    FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);

GRANT SELECT, INSERT, UPDATE, DELETE
    ON public.practitioner_availability_rules, public.consultation_slots
    TO anon, authenticated;

-- Generate full-duration slots for a local calendar date using India Standard Time.
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
    ON CONFLICT (practitioner_id, start_time) DO NOTHING;

    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
    RETURN v_inserted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.book_consultation_slot(
    p_slot_id UUID,
    p_patient_id UUID,
    p_chief_complaint TEXT
)
RETURNS public.consultations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_slot public.consultation_slots;
    v_consultation public.consultations;
BEGIN
    IF auth.uid() IS DISTINCT FROM p_patient_id THEN
        RAISE EXCEPTION 'Patient ID must match the authenticated user';
    END IF;

    SELECT * INTO v_slot
    FROM public.consultation_slots
    WHERE id = p_slot_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Consultation slot not found';
    END IF;
    IF v_slot.is_booked THEN
        RAISE EXCEPTION 'Consultation slot is already booked';
    END IF;
    IF v_slot.start_time <= NOW() THEN
        RAISE EXCEPTION 'Consultation slot must be in the future';
    END IF;
    IF p_chief_complaint IS NULL OR btrim(p_chief_complaint) = '' THEN
        RAISE EXCEPTION 'Chief complaint is required';
    END IF;

    INSERT INTO public.consultations (
        patient_id, doctor_id, slot_start, slot_end, status, chief_complaint
    )
    VALUES (
        p_patient_id, v_slot.practitioner_id, v_slot.start_time, v_slot.end_time,
        'scheduled', p_chief_complaint
    )
    RETURNING * INTO v_consultation;

    UPDATE public.consultation_slots
    SET is_booked = TRUE, consultation_id = v_consultation.id
    WHERE id = p_slot_id;

    RETURN v_consultation;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_consultation_slots(UUID, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.book_consultation_slot(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_consultation_slots(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.book_consultation_slot(UUID, UUID, TEXT) TO authenticated;
