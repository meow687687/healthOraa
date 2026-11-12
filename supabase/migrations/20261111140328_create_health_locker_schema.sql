CREATE TYPE public.diagnostic_category AS ENUM (
    'blood_panel', 'imaging_radiology', 'prescription', 'discharge_summary', 'other'
);

CREATE TABLE public.patient_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category public.diagnostic_category NOT NULL DEFAULT 'blood_panel',
    document_date DATE NOT NULL DEFAULT CURRENT_DATE,
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT,
    mime_type TEXT NOT NULL DEFAULT 'application/pdf',
    extracted_metadata JSONB DEFAULT '{}'::JSONB,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.patient_biomarkers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    marker_name TEXT NOT NULL,
    marker_value NUMERIC(8,2) NOT NULL,
    unit TEXT NOT NULL,
    reference_range TEXT,
    tested_at DATE NOT NULL,
    document_id UUID REFERENCES public.patient_documents(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_biomarkers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can read their health locker documents" ON public.patient_documents
    FOR SELECT TO authenticated
    USING (patient_id = (SELECT auth.uid()));
CREATE POLICY "Patients can add health locker documents" ON public.patient_documents
    FOR INSERT TO authenticated
    WITH CHECK (patient_id = (SELECT auth.uid()));
CREATE POLICY "Patients can read their biomarkers" ON public.patient_biomarkers
    FOR SELECT TO authenticated
    USING (patient_id = (SELECT auth.uid()));
CREATE POLICY "Patients can add their biomarkers" ON public.patient_biomarkers
    FOR INSERT TO authenticated
    WITH CHECK (patient_id = (SELECT auth.uid()));

GRANT SELECT, INSERT ON public.patient_documents, public.patient_biomarkers TO authenticated;

CREATE OR REPLACE FUNCTION public.get_patient_documents(p_patient_id UUID)
RETURNS SETOF public.patient_documents
LANGUAGE SQL
STABLE
SET search_path = ''
AS $$
    SELECT document.*
    FROM public.patient_documents AS document
    WHERE p_patient_id = (SELECT auth.uid())
      AND document.patient_id = p_patient_id
    ORDER BY document.document_date DESC, document.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_patient_biomarkers(
    p_patient_id UUID,
    p_marker_name TEXT DEFAULT NULL
)
RETURNS SETOF public.patient_biomarkers
LANGUAGE SQL
STABLE
SET search_path = ''
AS $$
    SELECT marker.*
    FROM public.patient_biomarkers AS marker
    WHERE p_patient_id = (SELECT auth.uid())
      AND marker.patient_id = p_patient_id
      AND (p_marker_name IS NULL OR marker.marker_name = p_marker_name)
    ORDER BY marker.tested_at DESC, marker.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_documents(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_biomarkers(UUID, TEXT) TO authenticated;

-- The bucket remains private; object-level access is managed by storage.objects RLS.
UPDATE storage.buckets SET public = FALSE WHERE id = 'patient-reports';
DO $$
BEGIN
    IF NOT (SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid = 'storage.objects'::REGCLASS) THEN
        RAISE EXCEPTION 'Row-level security must be enabled on storage.objects';
    END IF;
END;
$$;

DROP POLICY IF EXISTS "Development uploads to patient reports" ON storage.objects;
CREATE POLICY "Development uploads to patient reports" ON storage.objects
    FOR INSERT TO anon, authenticated
    WITH CHECK (bucket_id = 'patient-reports');

CREATE POLICY "Development downloads from patient reports" ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id = 'patient-reports');
