-- Do not treat an expired/cancelled order as a successful retry of checkout.
-- The client receives NULL, rotates its idempotency key, and asks the patient to
-- explicitly place the order again. Expired stock is released in this transaction.
CREATE OR REPLACE FUNCTION public.create_mobile_order(
    p_shipping_address TEXT,
    p_items JSONB,
    p_idempotency_key UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_customer UUID := (SELECT auth.uid());
    v_order_id UUID;
    v_item JSONB;
    v_product_id UUID;
    v_quantity INT;
    v_title TEXT;
    v_price NUMERIC(10, 2);
    v_stock INT;
    v_active BOOLEAN;
    v_subtotal_paise BIGINT := 0;
    v_total_paise BIGINT;
    v_checkout_fingerprint TEXT;
    v_existing_fingerprint TEXT;
    v_existing_status public.order_status;
    v_reservation_expires_at TIMESTAMPTZ;
    v_stock_released_at TIMESTAMPTZ;
    v_pending_reservations INT;
BEGIN
    IF public.current_user_role() IS DISTINCT FROM 'patient' THEN
        RAISE EXCEPTION 'Only active patient accounts can place orders';
    END IF;
    IF p_shipping_address IS NULL OR char_length(btrim(p_shipping_address)) NOT BETWEEN 10 AND 500 THEN
        RAISE EXCEPTION 'Shipping address must be between 10 and 500 characters';
    END IF;
    IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'An order needs an item list';
    END IF;
    IF jsonb_array_length(p_items) NOT BETWEEN 1 AND 50 THEN
        RAISE EXCEPTION 'An order needs between 1 and 50 items';
    END IF;
    IF (SELECT count(DISTINCT (line ->> 'product_id')::UUID) FROM jsonb_array_elements(p_items) AS line)
        <> jsonb_array_length(p_items) THEN
        RAISE EXCEPTION 'Each product can appear only once in an order';
    END IF;
    IF p_idempotency_key IS NULL THEN RAISE EXCEPTION 'Checkout idempotency key is required'; END IF;

    v_checkout_fingerprint := md5(btrim(p_shipping_address) || ':' || p_items::TEXT);
    -- Serialize fresh keys for this patient so parallel requests cannot bypass the reservation cap.
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(v_customer::TEXT || ':mobile-order-reservation-cap', 0)
    );
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(v_customer::TEXT || ':' || p_idempotency_key::TEXT, 0)
    );
    SELECT o.id, o.checkout_fingerprint, o.status, o.reservation_expires_at, o.stock_released_at
    INTO v_order_id, v_existing_fingerprint, v_existing_status, v_reservation_expires_at, v_stock_released_at
    FROM public.orders AS o
    WHERE o.customer_id = v_customer AND o.checkout_idempotency_key = p_idempotency_key
    FOR UPDATE;
    IF FOUND THEN
        IF v_existing_fingerprint IS DISTINCT FROM v_checkout_fingerprint THEN
            RAISE EXCEPTION 'Checkout idempotency key was already used for different details';
        END IF;
        IF v_existing_status = 'cancelled'::public.order_status THEN
            RETURN NULL;
        END IF;
        IF v_existing_status = 'pending'::public.order_status
            AND (v_reservation_expires_at IS NULL OR v_reservation_expires_at <= NOW() OR v_stock_released_at IS NOT NULL) THEN
            UPDATE public.orders
            SET status = 'cancelled'
            WHERE id = v_order_id AND status = 'pending';
            RETURN NULL;
        END IF;
        RETURN v_order_id;
    END IF;

    SELECT count(*)::INT INTO v_pending_reservations
    FROM public.orders AS o
    WHERE o.customer_id = v_customer
      AND o.status = 'pending'::public.order_status
      AND o.reservation_expires_at > NOW()
      AND o.stock_released_at IS NULL;
    IF v_pending_reservations >= 3 THEN
        RAISE EXCEPTION 'You already have 3 pending orders. Complete or wait for one to expire before placing another.';
    END IF;

    FOR v_item IN
        SELECT line FROM jsonb_array_elements(p_items) AS line ORDER BY line ->> 'product_id'
    LOOP
        v_product_id := (v_item ->> 'product_id')::UUID;
        IF jsonb_typeof(v_item -> 'quantity') IS DISTINCT FROM 'number' THEN
            RAISE EXCEPTION 'Quantity must be a whole number';
        END IF;
        v_quantity := (v_item ->> 'quantity')::INT;
        IF v_quantity NOT BETWEEN 1 AND 20 OR (v_item ->> 'quantity')::NUMERIC <> v_quantity THEN
            RAISE EXCEPTION 'Quantity must be a whole number between 1 and 20';
        END IF;
        SELECT p.title, p.price_inr, p.stock_count, p.is_active
        INTO v_title, v_price, v_stock, v_active
        FROM public.products AS p WHERE p.id = v_product_id FOR UPDATE;
        IF NOT FOUND OR NOT v_active THEN RAISE EXCEPTION 'A product in your cart is no longer available'; END IF;
        IF v_stock < v_quantity THEN RAISE EXCEPTION 'Only % of % left', v_stock, v_title; END IF;
        v_subtotal_paise := v_subtotal_paise + round(v_price * 100)::BIGINT * v_quantity;
    END LOOP;

    v_total_paise := v_subtotal_paise + round(v_subtotal_paise * 0.18)::BIGINT;
    BEGIN
        INSERT INTO public.orders (
            customer_id, total_amount_inr, status, shipping_address, reservation_expires_at,
            checkout_idempotency_key, checkout_fingerprint
        ) VALUES (
            v_customer, v_total_paise / 100.0, 'pending', btrim(p_shipping_address),
            NOW() + INTERVAL '30 minutes', p_idempotency_key, v_checkout_fingerprint
        ) RETURNING id INTO v_order_id;
    EXCEPTION WHEN unique_violation THEN
        SELECT o.id, o.checkout_fingerprint, o.status, o.reservation_expires_at, o.stock_released_at
        INTO v_order_id, v_existing_fingerprint, v_existing_status, v_reservation_expires_at, v_stock_released_at
        FROM public.orders AS o
        WHERE o.customer_id = v_customer AND o.checkout_idempotency_key = p_idempotency_key
        FOR UPDATE;
        IF NOT FOUND OR v_existing_fingerprint IS DISTINCT FROM v_checkout_fingerprint THEN
            RAISE EXCEPTION 'Checkout idempotency key could not be resolved';
        END IF;
        IF v_existing_status = 'cancelled'::public.order_status THEN
            RETURN NULL;
        END IF;
        IF v_existing_status = 'pending'::public.order_status
            AND (v_reservation_expires_at IS NULL OR v_reservation_expires_at <= NOW() OR v_stock_released_at IS NOT NULL) THEN
            UPDATE public.orders
            SET status = 'cancelled'
            WHERE id = v_order_id AND status = 'pending';
            RETURN NULL;
        END IF;
        RETURN v_order_id;
    END;

    FOR v_item IN
        SELECT line FROM jsonb_array_elements(p_items) AS line ORDER BY line ->> 'product_id'
    LOOP
        v_product_id := (v_item ->> 'product_id')::UUID;
        v_quantity := (v_item ->> 'quantity')::INT;
        SELECT p.price_inr INTO v_price FROM public.products AS p WHERE p.id = v_product_id;
        INSERT INTO public.order_items (order_id, product_id, quantity, unit_price_inr)
        VALUES (v_order_id, v_product_id, v_quantity, v_price);
        UPDATE public.products SET stock_count = stock_count - v_quantity WHERE id = v_product_id;
    END LOOP;
    RETURN v_order_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_mobile_order(TEXT, JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_mobile_order(TEXT, JSONB, UUID) TO authenticated;
