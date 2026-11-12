-- E-commerce orders for the wellness store.
-- The anon/authenticated policies below are for local development only and
-- must be replaced with admin-role checks before any shared environment.

CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    total_amount_inr NUMERIC(10,2) NOT NULL,
    status order_status NOT NULL DEFAULT 'pending',
    shipping_address TEXT NOT NULL,
    tracking_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Orders are readable" ON public.orders;
CREATE POLICY "Orders are readable" ON public.orders
    FOR SELECT
    TO anon, authenticated
    USING (TRUE);

DROP POLICY IF EXISTS "Orders are insertable" ON public.orders;
CREATE POLICY "Orders are insertable" ON public.orders
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Orders are updatable" ON public.orders;
CREATE POLICY "Orders are updatable" ON public.orders
    FOR UPDATE
    TO anon, authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Orders are deletable" ON public.orders;
CREATE POLICY "Orders are deletable" ON public.orders
    FOR DELETE
    TO anon, authenticated
    USING (TRUE);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO anon, authenticated;
