-- Payment gateway transactions and their audit trail.
-- The anon/authenticated policies below are for local development only and
-- must be replaced with admin-role checks before any shared environment.
-- Financial records must not be writable by the public in production.

CREATE TYPE payment_gateway AS ENUM ('razorpay', 'upi_direct');
CREATE TYPE payment_status AS ENUM ('initiated', 'captured', 'failed', 'refunded');

CREATE TABLE public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    consultation_id UUID REFERENCES public.consultations(id) ON DELETE SET NULL,
    gateway payment_gateway NOT NULL DEFAULT 'razorpay',
    gateway_payment_id TEXT UNIQUE,
    gateway_order_id TEXT,
    amount_inr NUMERIC(10,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status payment_status NOT NULL DEFAULT 'initiated',
    error_code TEXT,
    error_description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Payment transactions are readable" ON public.payment_transactions;
CREATE POLICY "Payment transactions are readable" ON public.payment_transactions
    FOR SELECT
    TO anon, authenticated
    USING (TRUE);

DROP POLICY IF EXISTS "Payment transactions are insertable" ON public.payment_transactions;
CREATE POLICY "Payment transactions are insertable" ON public.payment_transactions
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Payment transactions are updatable" ON public.payment_transactions;
CREATE POLICY "Payment transactions are updatable" ON public.payment_transactions
    FOR UPDATE
    TO anon, authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Payment transactions are deletable" ON public.payment_transactions;
CREATE POLICY "Payment transactions are deletable" ON public.payment_transactions
    FOR DELETE
    TO anon, authenticated
    USING (TRUE);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_transactions TO anon, authenticated;

-- consultations has RLS enabled with no policies, so embedded joins from
-- payment_transactions resolve to null. Read access is granted here for local
-- development only, matching the other admin read paths.
DROP POLICY IF EXISTS "Consultations are readable" ON public.consultations;
CREATE POLICY "Consultations are readable" ON public.consultations
    FOR SELECT
    TO anon, authenticated
    USING (TRUE);

GRANT SELECT ON public.consultations TO anon, authenticated;
