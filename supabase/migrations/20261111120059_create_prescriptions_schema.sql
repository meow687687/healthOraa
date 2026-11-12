-- Development-only policies: replace with participant/doctor authorization before deployment.
CREATE TABLE public.prescriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consultation_id UUID NOT NULL REFERENCES public.consultations(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    diagnosis TEXT NOT NULL,
    clinical_notes TEXT,
    followup_days INT NOT NULL DEFAULT 7,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.prescription_medicines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prescription_id UUID NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    dosage TEXT NOT NULL,
    frequency TEXT NOT NULL,
    duration_days INT NOT NULL DEFAULT 7,
    instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_medicines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Development read and write prescriptions" ON public.prescriptions
    FOR ALL TO anon, authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY "Development read and write prescription medicines" ON public.prescription_medicines
    FOR ALL TO anon, authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

GRANT SELECT, INSERT, UPDATE, DELETE
    ON public.prescriptions, public.prescription_medicines
    TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.complete_consultation_after_prescription()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.consultations
    SET status = 'completed',
        followup_expires_at = NOW() + (NEW.followup_days || ' days')::INTERVAL
    WHERE id = NEW.consultation_id;

    RETURN NEW;
END;
$$;

CREATE TRIGGER prescriptions_complete_consultation
AFTER INSERT ON public.prescriptions
FOR EACH ROW
EXECUTE FUNCTION public.complete_consultation_after_prescription();
