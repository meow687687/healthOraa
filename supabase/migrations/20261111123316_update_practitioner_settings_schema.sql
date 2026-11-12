ALTER TABLE public.practitioner_details
    ADD COLUMN IF NOT EXISTS bio TEXT,
    ADD COLUMN IF NOT EXISTS languages_spoken TEXT[] DEFAULT '{"English", "Hindi"}'::TEXT[],
    ADD COLUMN IF NOT EXISTS years_of_experience INT DEFAULT 5,
    ADD COLUMN IF NOT EXISTS avatar_url TEXT,
    ADD COLUMN IF NOT EXISTS signature_image_url TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE OR REPLACE FUNCTION public.update_practitioner_profile(
    p_qualification TEXT,
    p_consultation_fee_inr NUMERIC(10,2),
    p_slot_duration_minutes INT,
    p_bio TEXT,
    p_languages TEXT[],
    p_years_of_experience INT
)
RETURNS public.practitioner_details
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_practitioner_id UUID;
    v_practitioner public.practitioner_details;
BEGIN
    IF p_consultation_fee_inr IS NULL OR p_consultation_fee_inr < 0 THEN
        RAISE EXCEPTION 'Consultation fee must be non-negative';
    END IF;
    IF p_slot_duration_minutes IS NULL OR p_slot_duration_minutes NOT IN (15, 20, 30, 45, 60) THEN
        RAISE EXCEPTION 'Slot duration must be 15, 20, 30, 45, or 60 minutes';
    END IF;

    -- Local development fallback supports authenticated sessions without a mapped practitioner.
    v_practitioner_id := COALESCE(
        (SELECT auth.uid()),
        (SELECT id FROM public.practitioner_details ORDER BY created_at LIMIT 1)
    );
    IF v_practitioner_id IS NULL THEN
        RAISE EXCEPTION 'No practitioner profile is available to update';
    END IF;

    UPDATE public.practitioner_details
    SET qualification = p_qualification,
        consultation_fee_inr = p_consultation_fee_inr,
        slot_duration_minutes = p_slot_duration_minutes,
        bio = p_bio,
        languages_spoken = p_languages,
        years_of_experience = p_years_of_experience,
        updated_at = NOW()
    WHERE id = v_practitioner_id
    RETURNING * INTO v_practitioner;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Practitioner profile % not found', v_practitioner_id;
    END IF;

    RETURN v_practitioner;
END;
$$;

REVOKE ALL ON FUNCTION public.update_practitioner_profile(TEXT, NUMERIC, INT, TEXT, TEXT[], INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_practitioner_profile(TEXT, NUMERIC, INT, TEXT, TEXT[], INT) TO authenticated;
