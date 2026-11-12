-- Local development policies for the admin portal's Practitioners view.
-- WARNING: these grant read and update access to the anon role. They are for
-- local development only and must be replaced with admin-role checks before any
-- shared or production environment.

DROP POLICY IF EXISTS "Profiles are readable" ON public.profiles;
CREATE POLICY "Profiles are readable" ON public.profiles
    FOR SELECT
    TO anon, authenticated
    USING (TRUE);

DROP POLICY IF EXISTS "Practitioner details are readable" ON public.practitioner_details;
CREATE POLICY "Practitioner details are readable" ON public.practitioner_details
    FOR SELECT
    TO anon, authenticated
    USING (TRUE);

DROP POLICY IF EXISTS "Practitioner details are updatable" ON public.practitioner_details;
CREATE POLICY "Practitioner details are updatable" ON public.practitioner_details
    FOR UPDATE
    TO anon, authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT SELECT, UPDATE ON public.practitioner_details TO anon, authenticated;
