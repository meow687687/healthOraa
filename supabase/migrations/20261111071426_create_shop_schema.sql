-- Shop catalog schema.
-- The anon/authenticated policies below are for local development only and
-- must be replaced with admin-role checks before any shared environment.

CREATE TYPE product_category AS ENUM ('supplements', 'ayurvedic', 'skincare', 'equipment');

CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    category product_category NOT NULL,
    description TEXT,
    price_inr NUMERIC(10,2) NOT NULL,
    stock_count INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Products are readable" ON public.products;
CREATE POLICY "Products are readable" ON public.products
    FOR SELECT
    TO anon, authenticated
    USING (TRUE);

DROP POLICY IF EXISTS "Products are insertable" ON public.products;
CREATE POLICY "Products are insertable" ON public.products
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Products are updatable" ON public.products;
CREATE POLICY "Products are updatable" ON public.products
    FOR UPDATE
    TO anon, authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Products are deletable" ON public.products;
CREATE POLICY "Products are deletable" ON public.products
    FOR DELETE
    TO anon, authenticated
    USING (TRUE);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO anon, authenticated;
