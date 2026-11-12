-- Writes a signed prescription and its medicines in one transaction. Runs as the caller,
-- so RLS still limits it to the practitioner's own consultations. The prescription trigger
-- then completes the consultation and opens the follow-up window.
CREATE OR REPLACE FUNCTION public.issue_prescription(
    p_consultation_id UUID,
    p_diagnosis TEXT,
    p_clinical_notes TEXT,
    p_followup_days INT,
    p_medicines JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_patient_id UUID;
    v_prescription_id UUID := gen_random_uuid();
    v_medicine JSONB;
BEGIN
    IF length(btrim(coalesce(p_diagnosis, ''))) < 3 THEN
        RAISE EXCEPTION 'Diagnosis must be at least 3 characters';
    END IF;
    IF p_followup_days IS NULL OR p_followup_days < 0 OR p_followup_days > 60 THEN
        RAISE EXCEPTION 'Follow-up must be between 0 and 60 days';
    END IF;
    IF jsonb_typeof(p_medicines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_medicines) = 0 THEN
        RAISE EXCEPTION 'Add at least one medicine';
    END IF;

    SELECT c.patient_id INTO v_patient_id
    FROM public.consultations AS c
    WHERE c.id = p_consultation_id
      AND c.doctor_id = (SELECT auth.uid())
      AND c.status <> 'cancelled';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Consultation not found for this practitioner';
    END IF;

    INSERT INTO public.prescriptions (id, consultation_id, doctor_id, patient_id, diagnosis, clinical_notes, followup_days)
    VALUES (
        v_prescription_id, p_consultation_id, (SELECT auth.uid()), v_patient_id,
        btrim(p_diagnosis), NULLIF(btrim(coalesce(p_clinical_notes, '')), ''), p_followup_days
    );

    FOR v_medicine IN SELECT * FROM jsonb_array_elements(p_medicines) LOOP
        INSERT INTO public.prescription_medicines (
            prescription_id, name, dosage, frequency, duration_days, instructions
        )
        VALUES (
            v_prescription_id,
            btrim(v_medicine->>'name'),
            btrim(v_medicine->>'dosage'),
            btrim(v_medicine->>'frequency'),
            (v_medicine->>'duration_days')::INT,
            NULLIF(btrim(coalesce(v_medicine->>'instructions', '')), '')
        );
    END LOOP;

    RETURN v_prescription_id;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_prescription(UUID, TEXT, TEXT, INT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_prescription(UUID, TEXT, TEXT, INT, JSONB) TO authenticated;
