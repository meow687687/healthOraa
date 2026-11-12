-- Evolve the original enrolment table while preserving its existing dependencies.
ALTER TABLE public.program_enrolments RENAME COLUMN nutritionist_id TO dietitian_id;
ALTER TABLE public.program_enrolments
    RENAME CONSTRAINT program_enrolments_nutritionist_id_fkey TO program_enrolments_dietitian_id_fkey;
ALTER TABLE public.program_enrolments RENAME COLUMN starts_at TO started_at;

ALTER TABLE public.program_enrolments ADD COLUMN status TEXT;
UPDATE public.program_enrolments
SET status = CASE WHEN is_active THEN 'active' ELSE 'cancelled' END;
ALTER TABLE public.program_enrolments ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE public.program_enrolments ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.program_enrolments
    ADD CONSTRAINT program_enrolments_status_check
    CHECK (status IN ('active', 'completed', 'paused', 'cancelled'));
ALTER TABLE public.program_enrolments DROP COLUMN is_active;

CREATE TABLE public.program_progress_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enrolment_id UUID NOT NULL REFERENCES public.program_enrolments(id) ON DELETE CASCADE,
    day_number INT NOT NULL CHECK (day_number BETWEEN 1 AND 60),
    weight_kg NUMERIC(5,2),
    meals_logged JSONB DEFAULT '[]'::JSONB,
    water_intake_ml INT DEFAULT 0,
    dietitian_feedback TEXT,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (enrolment_id, day_number)
);

CREATE OR REPLACE FUNCTION public.set_program_enrolment_expiry()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF NEW.expires_at IS NULL THEN
        NEW.expires_at := NEW.started_at + INTERVAL '60 days';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER program_enrolments_set_expiry
    BEFORE INSERT ON public.program_enrolments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_program_enrolment_expiry();

ALTER TABLE public.program_enrolments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_progress_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Development read and write program enrolments" ON public.program_enrolments
    FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Development read and write program progress logs" ON public.program_progress_logs
    FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);

GRANT SELECT, INSERT, UPDATE, DELETE
    ON public.program_enrolments, public.program_progress_logs
    TO anon, authenticated;
