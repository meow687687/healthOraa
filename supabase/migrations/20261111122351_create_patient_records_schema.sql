CREATE TABLE public.patient_intake_forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    consultation_id UUID REFERENCES public.consultations(id) ON DELETE SET NULL,
    age INT NOT NULL,
    gender TEXT NOT NULL,
    chief_complaint TEXT NOT NULL,
    symptoms_duration TEXT,
    medical_history TEXT[] DEFAULT '{}'::TEXT[],
    known_allergies TEXT[] DEFAULT '{}'::TEXT[],
    current_medications TEXT[] DEFAULT '{}'::TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.diagnostic_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    consultation_id UUID REFERENCES public.consultations(id) ON DELETE SET NULL,
    report_title TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size_bytes BIGINT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.patient_intake_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients manage their own intake forms" ON public.patient_intake_forms
    FOR ALL TO authenticated
    USING (patient_id = (SELECT auth.uid()))
    WITH CHECK (patient_id = (SELECT auth.uid()));

CREATE POLICY "Consultation doctors can read intake forms" ON public.patient_intake_forms
    FOR SELECT TO authenticated
    USING (
        consultation_id IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.consultations AS c
            WHERE c.id = patient_intake_forms.consultation_id
              AND c.patient_id = patient_intake_forms.patient_id
              AND c.doctor_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Patients can read their diagnostic reports" ON public.diagnostic_reports
    FOR SELECT TO authenticated
    USING (patient_id = (SELECT auth.uid()));

CREATE POLICY "Consultation doctors can read diagnostic reports" ON public.diagnostic_reports
    FOR SELECT TO authenticated
    USING (
        consultation_id IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.consultations AS c
            WHERE c.id = diagnostic_reports.consultation_id
              AND c.patient_id = diagnostic_reports.patient_id
              AND c.doctor_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Patients manage their diagnostic reports" ON public.diagnostic_reports
    FOR INSERT TO authenticated
    WITH CHECK (patient_id = (SELECT auth.uid()));

CREATE POLICY "Patients update their diagnostic reports" ON public.diagnostic_reports
    FOR UPDATE TO authenticated
    USING (patient_id = (SELECT auth.uid()))
    WITH CHECK (patient_id = (SELECT auth.uid()));

CREATE POLICY "Patients delete their diagnostic reports" ON public.diagnostic_reports
    FOR DELETE TO authenticated
    USING (patient_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_intake_forms, public.diagnostic_reports TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-reports', 'patient-reports', FALSE)
ON CONFLICT (id) DO UPDATE SET public = FALSE;

-- Development-only upload access. Restrict uploads to authenticated patients before deployment.
CREATE POLICY "Development uploads to patient reports" ON storage.objects
    FOR INSERT TO anon, authenticated
    WITH CHECK (bucket_id = 'patient-reports');

-- Storage paths must begin with the consultation UUID: <consultation-id>/<filename>.
CREATE POLICY "Consultation participants can read patient reports" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'patient-reports'
        AND EXISTS (
            SELECT 1 FROM public.consultations AS c
            WHERE c.id::TEXT = (storage.foldername(name))[1]
              AND (c.patient_id = (SELECT auth.uid()) OR c.doctor_id = (SELECT auth.uid()))
        )
    );
