-- Patients need practitioner names for discovery, bookings, prescriptions and the follow-up chat.
-- The RBAC policy only lets a patient read their own profile, so these rows came back empty.
-- Allows a patient to read a practitioner profile when that practitioner is listed as active,
-- or when they share a consultation. Practitioner profiles also carry a phone number.
DROP POLICY IF EXISTS "Patients read their practitioners' profiles" ON public.profiles;
CREATE POLICY "Patients read their practitioners' profiles" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        role = 'practitioner'::user_role
        AND (SELECT current_user_role()) = 'patient'::user_role
        AND (
            EXISTS (
                SELECT 1 FROM public.practitioner_details AS pd
                WHERE pd.id = profiles.id AND pd.is_active
            )
            OR EXISTS (
                SELECT 1 FROM public.consultations AS c
                WHERE c.doctor_id = profiles.id AND c.patient_id = (SELECT auth.uid())
            )
        )
    );
