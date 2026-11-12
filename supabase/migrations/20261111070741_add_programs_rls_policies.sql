-- Local development policies for the admin portal's Programs management.
-- WARNING: these grant write access to the anon role. They are for local
-- development only and must be replaced with admin-role checks before any
-- shared or production environment.

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Programs are readable" ON public.programs;
CREATE POLICY "Programs are readable" ON public.programs
    FOR SELECT
    TO anon, authenticated
    USING (TRUE);

DROP POLICY IF EXISTS "Programs are insertable" ON public.programs;
CREATE POLICY "Programs are insertable" ON public.programs
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Programs are updatable" ON public.programs;
CREATE POLICY "Programs are updatable" ON public.programs
    FOR UPDATE
    TO anon, authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Programs are deletable" ON public.programs;
CREATE POLICY "Programs are deletable" ON public.programs
    FOR DELETE
    TO anon, authenticated
    USING (TRUE);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.programs TO anon, authenticated;
