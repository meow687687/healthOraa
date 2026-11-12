CREATE TABLE public.cart_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INT NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (patient_id, product_id)
);

CREATE TABLE public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price_inr NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients manage their own cart" ON public.cart_items
    FOR ALL TO authenticated
    USING (patient_id = (SELECT auth.uid()))
    WITH CHECK (patient_id = (SELECT auth.uid()));

CREATE POLICY "Patients can read their own order items" ON public.order_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.orders AS shop_order
            WHERE shop_order.id = order_items.order_id
              AND shop_order.customer_id = (SELECT auth.uid())
        )
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT SELECT ON public.order_items TO authenticated;

CREATE OR REPLACE FUNCTION public.place_shop_order(
    p_patient_id UUID,
    p_shipping_address TEXT
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_order public.orders;
    v_item RECORD;
    v_total NUMERIC(10,2) := 0;
    v_item_count INT := 0;
BEGIN
    IF auth.uid() IS DISTINCT FROM p_patient_id THEN
        RAISE EXCEPTION 'Patient ID must match the authenticated user';
    END IF;
    IF p_shipping_address IS NULL OR btrim(p_shipping_address) = '' THEN
        RAISE EXCEPTION 'Shipping address is required';
    END IF;

    -- Lock cart and product rows in a stable order until this transaction completes.
    FOR v_item IN
        SELECT cart.product_id, cart.quantity, product.price_inr, product.stock_count, product.is_active
        FROM public.cart_items AS cart
        JOIN public.products AS product ON product.id = cart.product_id
        WHERE cart.patient_id = p_patient_id
        ORDER BY cart.product_id
        FOR UPDATE OF cart, product
    LOOP
        v_item_count := v_item_count + 1;
        IF NOT v_item.is_active THEN
            RAISE EXCEPTION 'Product % is no longer available', v_item.product_id;
        END IF;
        IF v_item.stock_count < v_item.quantity THEN
            RAISE EXCEPTION 'Insufficient stock for product %', v_item.product_id;
        END IF;
        v_total := v_total + v_item.price_inr * v_item.quantity;
    END LOOP;

    IF v_item_count = 0 THEN
        RAISE EXCEPTION 'Cart is empty';
    END IF;

    INSERT INTO public.orders (customer_id, total_amount_inr, status, shipping_address)
    VALUES (p_patient_id, v_total, 'pending', btrim(p_shipping_address))
    RETURNING * INTO v_order;

    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price_inr)
    SELECT v_order.id, cart.product_id, cart.quantity, product.price_inr
    FROM public.cart_items AS cart
    JOIN public.products AS product ON product.id = cart.product_id
    WHERE cart.patient_id = p_patient_id;

    UPDATE public.products AS product
    SET stock_count = product.stock_count - cart.quantity
    FROM public.cart_items AS cart
    WHERE cart.patient_id = p_patient_id
      AND cart.product_id = product.id;

    DELETE FROM public.cart_items WHERE patient_id = p_patient_id;

    RETURN v_order;
END;
$$;

REVOKE ALL ON FUNCTION public.place_shop_order(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_shop_order(UUID, TEXT) TO authenticated;
