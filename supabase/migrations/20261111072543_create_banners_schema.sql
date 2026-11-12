-- Promotional carousel banners shown on the patient mobile app.
-- The anon/authenticated policies below are for local development only and
-- must be replaced with admin-role checks before any shared environment.

CREATE TYPE banner_target_type AS ENUM ('program', 'doctor', 'shop_product', 'external_url');

CREATE TABLE public.app_banners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    image_url TEXT NOT NULL,
    target_type banner_target_type NOT NULL,
    target_id TEXT,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Banners are readable" ON public.app_banners;
CREATE POLICY "Banners are readable" ON public.app_banners
    FOR SELECT
    TO anon, authenticated
    USING (TRUE);

DROP POLICY IF EXISTS "Banners are insertable" ON public.app_banners;
CREATE POLICY "Banners are insertable" ON public.app_banners
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Banners are updatable" ON public.app_banners;
CREATE POLICY "Banners are updatable" ON public.app_banners
    FOR UPDATE
    TO anon, authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Banners are deletable" ON public.app_banners;
CREATE POLICY "Banners are deletable" ON public.app_banners
    FOR DELETE
    TO anon, authenticated
    USING (TRUE);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_banners TO anon, authenticated;
