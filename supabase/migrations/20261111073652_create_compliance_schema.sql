-- DPDPA 2023 data subject requests: export, erasure and consent withdrawal.
-- The anon/authenticated policies below are for local development only and
-- must be replaced with admin-role checks before any shared environment.

CREATE TYPE compliance_request_type AS ENUM ('data_export', 'erasure_request', 'consent_withdrawal');
CREATE TYPE compliance_request_status AS ENUM ('pending', 'processing', 'completed', 'rejected');

CREATE TABLE public.compliance_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    request_type compliance_request_type NOT NULL,
    status compliance_request_status NOT NULL DEFAULT 'pending',
    notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.compliance_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Compliance requests are readable" ON public.compliance_requests;
CREATE POLICY "Compliance requests are readable" ON public.compliance_requests
    FOR SELECT
    TO anon, authenticated
    USING (TRUE);

DROP POLICY IF EXISTS "Compliance requests are insertable" ON public.compliance_requests;
CREATE POLICY "Compliance requests are insertable" ON public.compliance_requests
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Compliance requests are updatable" ON public.compliance_requests;
CREATE POLICY "Compliance requests are updatable" ON public.compliance_requests
    FOR UPDATE
    TO anon, authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Compliance requests are deletable" ON public.compliance_requests;
CREATE POLICY "Compliance requests are deletable" ON public.compliance_requests
    FOR DELETE
    TO anon, authenticated
    USING (TRUE);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_requests TO anon, authenticated;

-- The export packet reads patient history. These tables have RLS enabled with
-- no policies, so without read access the export would silently return nothing.
-- Read-only, for local development only.
DROP POLICY IF EXISTS "Consultation messages are readable" ON public.consultation_messages;
CREATE POLICY "Consultation messages are readable" ON public.consultation_messages
    FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "Program messages are readable" ON public.program_messages;
CREATE POLICY "Program messages are readable" ON public.program_messages
    FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "Program enrolments are readable" ON public.program_enrolments;
CREATE POLICY "Program enrolments are readable" ON public.program_enrolments
    FOR SELECT TO anon, authenticated USING (TRUE);

GRANT SELECT ON public.consultation_messages, public.program_messages, public.program_enrolments
    TO anon, authenticated;

-- Anonymises a user's personal data and closes the request in one transaction,
-- so the profile is never changed without the request record being updated too.
-- Orders, payments and consultations keep their rows: they are statutory records.
CREATE OR REPLACE FUNCTION public.resolve_erasure_request(p_request_id UUID)
RETURNS public.compliance_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request public.compliance_requests;
BEGIN
    SELECT * INTO v_request FROM public.compliance_requests WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Compliance request % not found', p_request_id;
    END IF;
    IF v_request.request_type <> 'erasure_request' THEN
        RAISE EXCEPTION 'Request % is not an erasure request', p_request_id;
    END IF;

    UPDATE public.profiles
    SET full_name = 'Anonymised User',
        phone = NULL,
        avatar_url = NULL,
        updated_at = NOW()
    WHERE id = v_request.user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile % for erasure request % was not updated', v_request.user_id, p_request_id;
    END IF;

    UPDATE public.compliance_requests
    SET status = 'completed',
        notes = 'Personal data anonymised: name, phone and avatar cleared. Order, payment and consultation records retained for statutory tax and medical record requirements.',
        resolved_at = NOW()
    WHERE id = p_request_id
    RETURNING * INTO v_request;

    RETURN v_request;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_erasure_request(UUID) TO anon, authenticated;
