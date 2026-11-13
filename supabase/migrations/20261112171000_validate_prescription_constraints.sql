-- Validates the constraints added NOT VALID in 20261112170000. Runs in its own transaction, so the
-- scan does not hold the lock taken when the constraints were re-added. Fails loudly if an existing
-- row breaks a rule, which is the intent: such a row needs a human decision.
ALTER TABLE public.prescription_medicines VALIDATE CONSTRAINT prescription_medicines_name_present;
ALTER TABLE public.prescription_medicines VALIDATE CONSTRAINT prescription_medicines_dosage_present;
ALTER TABLE public.prescription_medicines VALIDATE CONSTRAINT prescription_medicines_frequency_present;
ALTER TABLE public.prescription_medicines VALIDATE CONSTRAINT prescription_medicines_duration_range;
ALTER TABLE public.prescriptions VALIDATE CONSTRAINT prescriptions_followup_days_range;
