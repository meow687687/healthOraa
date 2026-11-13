-- Mobile orders, immediate revocation on account deletion, and best-seller data.

-- 1. Deleted accounts. delete-account sets deleted_at before anything else, so the account stops working at once.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. Revocation. current_user_role() returns no role for a deleted account. Every role-based policy then denies
--    it on the next request, even if its access token has not expired. Ownership-only checks are not used on
--    these tables, and the profile update policy compares against this role, so it is denied too.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT p.role
    FROM public.profiles AS p
    WHERE p.id = (SELECT auth.uid())
      AND p.deleted_at IS NULL
$$;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- 3. Consultation booking, with the same logic as 20261113082049, plus a check that the caller is an active patient.
CREATE OR REPLACE FUNCTION public.initiate_consultation_booking(
    p_slot_id UUID,
    p_patient_id UUID,
    p_chief_complaint TEXT
)
RETURNS TABLE (
    consultation_row public.consultations,
    order_id TEXT,
    fee_paise BIGINT,
    gst_paise BIGINT,
    total_paise BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_slot public.consultation_slots;
    v_fee_inr NUMERIC(10, 2);
    v_fee_paise BIGINT;
    v_gst_paise BIGINT;
    v_total_paise BIGINT;
    v_consultation public.consultations;
    v_order_id TEXT;
BEGIN
    IF auth.uid() IS DISTINCT FROM p_patient_id THEN
        RAISE EXCEPTION 'Patient ID must match the authenticated user';
    END IF;
    IF public.current_user_role() IS DISTINCT FROM 'patient' THEN
        RAISE EXCEPTION 'Only active patient accounts can book consultations';
    END IF;
    IF p_chief_complaint IS NULL OR btrim(p_chief_complaint) = '' THEN
        RAISE EXCEPTION 'Chief complaint is required';
    END IF;

    SELECT * INTO v_slot
    FROM public.consultation_slots
    WHERE id = p_slot_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Consultation slot not found';
    END IF;
    IF v_slot.is_booked THEN
        RAISE EXCEPTION 'Consultation slot is already held or booked';
    END IF;
    IF v_slot.start_time <= NOW() THEN
        RAISE EXCEPTION 'Consultation slot must be in the future';
    END IF;

    SELECT pd.consultation_fee_inr INTO v_fee_inr
    FROM public.practitioner_details AS pd
    WHERE pd.id = v_slot.practitioner_id AND pd.is_active;
    IF NOT FOUND OR v_fee_inr IS NULL THEN
        RAISE EXCEPTION 'Practitioner is not accepting consultations';
    END IF;

    v_fee_paise := round(v_fee_inr * 100)::BIGINT;
    v_gst_paise := round(v_fee_paise * 0.18)::BIGINT;
    v_total_paise := v_fee_paise + v_gst_paise;
    v_order_id := 'order_mock_' || substr(md5(random()::TEXT), 1, 14);

    INSERT INTO public.consultations (
        patient_id, doctor_id, slot_start, slot_end, status, chief_complaint,
        booking_status, slot_id, payment_order_id, amount_inr
    )
    VALUES (
        p_patient_id, v_slot.practitioner_id, v_slot.start_time, v_slot.end_time,
        'scheduled', p_chief_complaint, 'pending_payment', p_slot_id,
        v_order_id, v_total_paise / 100.0
    )
    RETURNING * INTO v_consultation;

    UPDATE public.consultation_slots
    SET is_booked = TRUE, consultation_id = v_consultation.id
    WHERE id = p_slot_id AND NOT is_booked;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Consultation slot is already held or booked';
    END IF;

    INSERT INTO public.razorpay_order_logs (
        order_id, user_id, amount_paise, currency, status, entity_type, entity_id
    )
    VALUES (
        v_order_id, p_patient_id, v_total_paise, 'INR', 'created',
        'consultation', v_consultation.id
    );

    RETURN QUERY SELECT v_consultation, v_order_id, v_fee_paise, v_gst_paise, v_total_paise;
END;
$$;

REVOKE ALL ON FUNCTION public.initiate_consultation_booking(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.initiate_consultation_booking(UUID, UUID, TEXT) TO authenticated;

-- 4. Shop orders are created in one transaction: the order, its lines (with price snapshots), and the stock
--    decrement. Prices and totals are computed here, never taken from the client. Products are locked in id order
--    so concurrent checkouts cannot deadlock. Any failure rolls back the whole order.
CREATE OR REPLACE FUNCTION public.create_mobile_order(p_shipping_address TEXT, p_items JSONB)
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
BEGIN
    IF public.current_user_role() IS DISTINCT FROM 'patient' THEN
        RAISE EXCEPTION 'Only active patient accounts can place orders';
    END IF;
    IF p_shipping_address IS NULL OR char_length(btrim(p_shipping_address)) NOT BETWEEN 10 AND 500 THEN
        RAISE EXCEPTION 'Shipping address must be between 10 and 500 characters';
    END IF;
    IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 50 THEN
        RAISE EXCEPTION 'An order needs between 1 and 50 items';
    END IF;
    IF (SELECT count(DISTINCT line ->> 'product_id') FROM jsonb_array_elements(p_items) AS line)
        <> jsonb_array_length(p_items) THEN
        RAISE EXCEPTION 'Each product can appear only once in an order';
    END IF;

    -- First pass: lock, validate and price every line.
    FOR v_item IN
        SELECT line FROM jsonb_array_elements(p_items) AS line ORDER BY line ->> 'product_id'
    LOOP
        v_product_id := (v_item ->> 'product_id')::UUID;
        IF jsonb_typeof(v_item -> 'quantity') IS DISTINCT FROM 'number' THEN
            RAISE EXCEPTION 'Quantity must be a whole number';
        END IF;
        v_quantity := (v_item ->> 'quantity')::INT;
        IF v_quantity NOT BETWEEN 1 AND 20 THEN
            RAISE EXCEPTION 'Quantity must be between 1 and 20';
        END IF;

        SELECT p.title, p.price_inr, p.stock_count, p.is_active
        INTO v_title, v_price, v_stock, v_active
        FROM public.products AS p
        WHERE p.id = v_product_id
        FOR UPDATE;

        IF NOT FOUND OR NOT v_active THEN
            RAISE EXCEPTION 'A product in your cart is no longer available';
        END IF;
        IF v_stock < v_quantity THEN
            RAISE EXCEPTION 'Only % of % left', v_stock, v_title;
        END IF;
        v_subtotal_paise := v_subtotal_paise + round(v_price * 100)::BIGINT * v_quantity;
    END LOOP;

    v_total_paise := v_subtotal_paise + round(v_subtotal_paise * 0.18)::BIGINT;

    INSERT INTO public.orders (customer_id, total_amount_inr, status, shipping_address)
    VALUES (v_customer, v_total_paise / 100.0, 'pending', btrim(p_shipping_address))
    RETURNING id INTO v_order_id;

    -- Second pass: write the lines and decrement stock, using the same locked rows.
    FOR v_item IN
        SELECT line FROM jsonb_array_elements(p_items) AS line ORDER BY line ->> 'product_id'
    LOOP
        v_product_id := (v_item ->> 'product_id')::UUID;
        v_quantity := (v_item ->> 'quantity')::INT;
        SELECT p.price_inr INTO v_price FROM public.products AS p WHERE p.id = v_product_id;

        INSERT INTO public.order_items (order_id, product_id, quantity, unit_price_inr)
        VALUES (v_order_id, v_product_id, v_quantity, v_price);

        UPDATE public.products
        SET stock_count = stock_count - v_quantity
        WHERE id = v_product_id;
    END LOOP;

    RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_mobile_order(TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_mobile_order(TEXT, JSONB) TO authenticated;

-- 5. Best-sellers, from non-cancelled order lines. Only product fields and unit counts are returned, never
--    customer data. Products with no sales follow after the sold ones, with units_sold = 0, so the caller can
--    label them honestly.
CREATE OR REPLACE FUNCTION public.get_best_sellers(p_limit INT DEFAULT 6)
RETURNS TABLE (
    id UUID,
    title TEXT,
    category public.product_category,
    price_inr NUMERIC,
    stock_count INT,
    units_sold BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    WITH sold AS (
        SELECT oi.product_id, sum(oi.quantity)::BIGINT AS units
        FROM public.order_items AS oi
        JOIN public.orders AS o ON o.id = oi.order_id
        WHERE o.status <> 'cancelled'
        GROUP BY oi.product_id
    )
    SELECT p.id, p.title, p.category, p.price_inr, p.stock_count, COALESCE(s.units, 0) AS units_sold
    FROM public.products AS p
    LEFT JOIN sold AS s ON s.product_id = p.id
    WHERE p.is_active
      AND p.stock_count > 0
      AND (SELECT public.current_user_role()) = 'patient'::public.user_role
    ORDER BY COALESCE(s.units, 0) DESC, p.title
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 6), 12))
$$;

REVOKE ALL ON FUNCTION public.get_best_sellers(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_best_sellers(INT) TO authenticated;
