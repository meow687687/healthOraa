-- Allow patients to remove their own failed, unreferenced Health Locker uploads.
-- A document row prevents deletion, including when the metadata write committed but its response was lost.
DROP POLICY IF EXISTS "Patients can add health locker documents" ON public.patient_documents;
DROP POLICY IF EXISTS "Patients add own health locker documents" ON public.patient_documents;
CREATE POLICY "Patients add owned health locker documents" ON public.patient_documents
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
    );

CREATE POLICY "Patients delete unreferenced medical records" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'medical-records'
        AND public.current_user_role() = 'patient'
        AND split_part(name, '/', 1) = (SELECT auth.uid())::text
        AND split_part(name, '/', 2) = 'locker'
        AND owner_id = (SELECT auth.uid())::text
        AND NOT EXISTS (
            SELECT 1 FROM public.patient_documents document
            WHERE document.patient_id = (SELECT auth.uid())
              AND document.file_path = storage.objects.name
        )
        AND NOT EXISTS (
            SELECT 1 FROM public.diagnostic_reports report
            WHERE report.patient_id = (SELECT auth.uid())
              AND position(storage.objects.name IN report.file_url) > 0
        )
    );
