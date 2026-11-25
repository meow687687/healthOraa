-- Only the trusted seed/service role may label a persisted locker row as demo-only.
DROP POLICY IF EXISTS "Patients add owned health locker documents"
ON public.patient_documents;

CREATE POLICY "Patients add owned health locker documents"
ON public.patient_documents
FOR INSERT TO authenticated
WITH CHECK (
    patient_id = (SELECT auth.uid())
    AND public.current_user_role() = 'patient'
    AND file_path ~ ('^' || (SELECT auth.uid())::text || '/locker/[^/]+$')
    AND split_part(file_path, '/', 3) NOT IN ('.', '..')
    AND EXISTS (
        SELECT 1 FROM storage.objects object
        WHERE object.bucket_id = 'medical-records'
          AND object.name = patient_documents.file_path
          AND object.owner_id = (SELECT auth.uid())::text
    )
    AND extracted_metadata->>'demo_only' IS DISTINCT FROM 'true'
);
