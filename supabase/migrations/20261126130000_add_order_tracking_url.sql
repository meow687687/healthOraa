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
            AND tracking_url ~ '^https://(?:[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?|\[[0-9A-Fa-f:.]+\])(?::[0-9]{1,5})?([/?#][^[:space:]]*)?$'
            AND CASE
                WHEN tracking_url ~ '^https://\[[0-9A-Fa-f:.]+\]'
                THEN family((regexp_match(tracking_url, '^https://\[([0-9A-Fa-f:.]+)\]'))[1]::INET) = 6
                ELSE TRUE
            END
            AND CASE
                WHEN tracking_url ~ '^https://(?:[A-Za-z0-9.-]+\.)?(?:[0-9]+|0[xX][0-9A-Fa-f]*)(?::[0-9]{1,5})?([/?#]|$)'
                THEN tracking_url ~ '^https://(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])(?:\.(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])){3}(?::[0-9]{1,5})?([/?#]|$)'
                ELSE TRUE
            END
            AND CASE
                WHEN tracking_url ~ '^https://(?:[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?|\[[0-9A-Fa-f:.]+\]):[0-9]{1,5}([/?#]|$)'
                THEN (regexp_match(tracking_url, '^https://(?:[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?|\[[0-9A-Fa-f:.]+\]):([0-9]{1,5})([/?#]|$)'))[1]::INTEGER <= 65535
                ELSE TRUE
            END
        )
    );
