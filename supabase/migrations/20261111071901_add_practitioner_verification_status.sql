CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');

-- Existing practitioners predate the audit workflow, so they default to verified.
ALTER TABLE public.practitioner_details
    ADD COLUMN verification_status verification_status NOT NULL DEFAULT 'verified',
    ADD COLUMN rejection_reason TEXT,
    ADD COLUMN documents_url TEXT;
