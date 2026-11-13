-- Public practitioner listing. Patients see a fixed set of profile fields before booking.
-- Phone numbers and other contact details stay private until the patient has a consultation
-- with that practitioner, which is the only case the profiles policy below still allows.

-- 1. Discovery reads go through this function, which returns nothing beyond these columns.
--    specialization is not stored yet, so it is returned as NULL. Adding that column is a schema change
--    and is left for a separate, approved migration.
CREATE OR REPLACE FUNCTION public.get_verified_practitioners()
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    avatar_url TEXT,
    qualification TEXT,
    specialization TEXT,
    years_of_experience INT,
    consultation_fee_inr NUMERIC,
    slot_duration_minutes INT,
    bio TEXT,
    languages_spoken TEXT[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT pd.id,
           p.full_name,
           pd.avatar_url,
           pd.qualification,
           NULL::TEXT AS specialization,
           pd.years_of_experience,
           pd.consultation_fee_inr,
           pd.slot_duration_minutes,
           pd.bio,
           pd.languages_spoken
    FROM public.practitioner_details AS pd
    JOIN public.profiles AS p ON p.id = pd.id
    WHERE pd.is_active
      AND pd.verification_status = 'verified'
      AND p.role = 'practitioner'
    ORDER BY p.full_name;
$$;

REVOKE ALL ON FUNCTION public.get_verified_practitioners() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_verified_practitioners() TO authenticated;

-- 2. Patients no longer read full practitioner profile rows just because a practitioner is active.
--    The profile row carries the phone number, so access is limited to practitioners the patient has
--    booked, and to the dietitian on one of the patient's own program enrolments.
DROP POLICY IF EXISTS "Patients read their practitioners' profiles" ON public.profiles;
CREATE POLICY "Patients read their practitioners' profiles" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        role = 'practitioner'::user_role
        AND (SELECT public.current_user_role()) = 'patient'::user_role
        AND (
            EXISTS (
                SELECT 1 FROM public.consultations AS c
                WHERE c.doctor_id = profiles.id AND c.patient_id = (SELECT auth.uid())
            )
            OR EXISTS (
                SELECT 1 FROM public.program_enrolments AS e
                WHERE e.dietitian_id = profiles.id AND e.patient_id = (SELECT auth.uid())
            )
        )
    );
