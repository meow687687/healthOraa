-- Use dedicated private buckets for medical records and diet/program attachments.
-- Keep the existing patient-reports bucket private for links created by older app versions.
INSERT INTO storage.buckets (id, name, public)
VALUES
    ('medical-records', 'medical-records', FALSE),
    ('diet-charts', 'diet-charts', FALSE)
ON CONFLICT (id) DO UPDATE SET public = FALSE;

UPDATE storage.buckets
SET public = FALSE,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png']
WHERE id IN ('medical-records', 'patient-reports');

UPDATE storage.buckets
SET public = FALSE,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png']
WHERE id = 'diet-charts';

-- Keep practitioner contact fields private while still returning the names needed by a patient's own visits.
DROP POLICY IF EXISTS "Patients read their practitioners' profiles" ON public.profiles;

-- A pending booking request is not enough to reveal the patient's full profile to a practitioner.
DROP POLICY IF EXISTS "Profiles read own or assigned patient" ON public.profiles;
CREATE POLICY "Profiles read own or confirmed patient" ON public.profiles
    FOR SELECT TO authenticated
    USING (
        id = (SELECT auth.uid())
        OR (
            role = 'patient'
            AND public.current_user_role() = 'practitioner'
            AND EXISTS (
                SELECT 1 FROM public.consultations c
                WHERE c.patient_id = profiles.id
                  AND c.doctor_id = (SELECT auth.uid())
                  AND c.booking_status = 'confirmed'
            )
        )
    );

CREATE OR REPLACE FUNCTION public.get_consultation_practitioner_names(p_consultation_ids UUID[])
RETURNS TABLE (consultation_id UUID, full_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT c.id, p.full_name
    FROM public.consultations c
    JOIN public.profiles p ON p.id = c.doctor_id
    JOIN public.profiles owner ON owner.id = (SELECT auth.uid())
    WHERE c.id = ANY(COALESCE(p_consultation_ids, ARRAY[]::UUID[]))
      AND c.patient_id = (SELECT auth.uid())
      AND owner.deleted_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.get_consultation_practitioner_names(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_consultation_practitioner_names(UUID[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_program_dietitian_name(p_enrolment_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT dietitian.full_name
    FROM public.program_enrolments e
    JOIN public.profiles owner ON owner.id = (SELECT auth.uid())
    JOIN public.profiles dietitian ON dietitian.id = e.dietitian_id
    WHERE e.id = p_enrolment_id
      AND e.patient_id = (SELECT auth.uid())
      AND e.status = 'active'
      AND owner.deleted_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.get_program_dietitian_name(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_program_dietitian_name(UUID) TO authenticated;

CREATE POLICY "Patients read own medical records" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'medical-records'
        AND public.current_user_role() = 'patient'
        AND (
            split_part(name, '/', 1) = (SELECT auth.uid())::text
            OR EXISTS (
                SELECT 1 FROM public.consultations c
                WHERE c.id::text = split_part(name, '/', 1)
                  AND c.patient_id = (SELECT auth.uid())
                  AND c.booking_status = 'confirmed'
            )
        )
    );

CREATE POLICY "Patients upload own medical records" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'medical-records'
        AND public.current_user_role() = 'patient'
        AND split_part(name, '/', 1) = (SELECT auth.uid())::text
    );

CREATE POLICY "Practitioners read assigned medical records" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'medical-records'
        AND public.current_user_role() = 'practitioner'
        AND EXISTS (
            SELECT 1 FROM public.consultations c
            WHERE c.doctor_id = (SELECT auth.uid())
              AND c.patient_id::text = split_part(name, '/', 1)
              AND c.booking_status = 'confirmed'
        )
    );

CREATE POLICY "Practitioners upload assigned medical records" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'medical-records'
        AND public.current_user_role() = 'practitioner'
        AND EXISTS (
            SELECT 1 FROM public.consultations c
            WHERE c.doctor_id = (SELECT auth.uid())
              AND c.patient_id::text = split_part(name, '/', 1)
              AND c.booking_status = 'confirmed'
        )
    );

CREATE POLICY "Patients read own diet charts" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'diet-charts'
        AND public.current_user_role() = 'patient'
        AND split_part(name, '/', 1) = (SELECT auth.uid())::text
    );

CREATE POLICY "Patients upload own diet charts" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'diet-charts'
        AND public.current_user_role() = 'patient'
        AND split_part(name, '/', 1) = (SELECT auth.uid())::text
        AND split_part(name, '/', 2) = 'meals'
        AND owner_id = (SELECT auth.uid())::text
        AND EXISTS (
            SELECT 1 FROM public.program_enrolments e
            WHERE e.patient_id = (SELECT auth.uid())
              AND e.status = 'active'
              AND e.expires_at > NOW()
        )
    );

CREATE POLICY "Patients delete unreferenced meal photos" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'diet-charts'
        AND public.current_user_role() = 'patient'
        AND split_part(name, '/', 1) = (SELECT auth.uid())::text
        AND split_part(name, '/', 2) = 'meals'
        AND NOT EXISTS (
            SELECT 1 FROM public.program_messages message
            WHERE message.attachment_url = storage.objects.name
        )
    );

CREATE POLICY "Practitioners read assigned diet charts" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'diet-charts'
        AND public.current_user_role() = 'practitioner'
        AND EXISTS (
            SELECT 1 FROM public.program_enrolments e
            WHERE e.patient_id::text = split_part(name, '/', 1)
              AND e.dietitian_id = (SELECT auth.uid())
              AND e.status = 'active'
              AND e.expires_at > NOW()
        )
    );

CREATE POLICY "Practitioners upload assigned diet charts" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'diet-charts'
        AND public.current_user_role() = 'practitioner'
        AND split_part(name, '/', 2) = 'dietitian'
        AND EXISTS (
            SELECT 1 FROM public.program_enrolments e
            WHERE e.patient_id::text = split_part(name, '/', 1)
              AND e.dietitian_id = (SELECT auth.uid())
              AND e.status = 'active'
              AND e.expires_at > NOW()
        )
    );
