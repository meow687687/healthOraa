ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS tracking_url TEXT;

ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_tracking_url_https_check;

ALTER TABLE public.orders
    ADD CONSTRAINT orders_tracking_url_https_check
    CHECK (
        tracking_url IS NULL
        OR (
            char_length(tracking_url) <= 2048
            AND tracking_url ~ '^https://[^[:space:]]+$'
        )
    );
