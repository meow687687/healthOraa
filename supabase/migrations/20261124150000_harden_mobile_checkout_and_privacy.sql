-- Close mobile checkout trust-boundary gaps and keep device tokens owner-private.

-- Orders are created only through a SECURITY DEFINER transaction that prices products and reserves stock.
DROP POLICY IF EXISTS "Patients place own orders" ON public.orders;
DROP POLICY IF EXISTS "Orders are insertable" ON public.orders;
REVOKE INSERT ON public.orders FROM anon, authenticated;

-- Keep the older cart RPC unavailable to clients and fail closed if it is ever called by a deleted account.
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
    IF auth.uid() IS DISTINCT FROM p_patient_id
       OR public.current_user_role() IS DISTINCT FROM 'patient'::public.user_role THEN
        RAISE EXCEPTION 'Only active patients may place their own orders';
    END IF;
    IF p_shipping_address IS NULL OR char_length(btrim(p_shipping_address)) NOT BETWEEN 10 AND 500 THEN
        RAISE EXCEPTION 'Shipping address must be between 10 and 500 characters';
    END IF;

    FOR v_item IN
        SELECT cart.product_id, cart.quantity, product.price_inr, product.stock_count, product.is_active
        FROM public.cart_items AS cart
        JOIN public.products AS product ON product.id = cart.product_id
        WHERE cart.patient_id = p_patient_id
        ORDER BY cart.product_id
        FOR UPDATE OF cart, product
    LOOP
        v_item_count := v_item_count + 1;
        IF NOT v_item.is_active OR v_item.stock_count < v_item.quantity THEN
            RAISE EXCEPTION 'A product in your cart is unavailable';
        END IF;
        v_total := v_total + v_item.price_inr * v_item.quantity;
    END LOOP;
    IF v_item_count = 0 THEN RAISE EXCEPTION 'Cart is empty'; END IF;

    INSERT INTO public.orders (customer_id, total_amount_inr, status, shipping_address)
    VALUES (p_patient_id, v_total, 'pending', btrim(p_shipping_address)) RETURNING * INTO v_order;
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price_inr)
    SELECT v_order.id, cart.product_id, cart.quantity, product.price_inr
    FROM public.cart_items AS cart JOIN public.products AS product ON product.id = cart.product_id
    WHERE cart.patient_id = p_patient_id;
    UPDATE public.products AS product SET stock_count = product.stock_count - cart.quantity
    FROM public.cart_items AS cart
    WHERE cart.patient_id = p_patient_id AND cart.product_id = product.id;
    DELETE FROM public.cart_items WHERE patient_id = p_patient_id;
    RETURN v_order;
END;
$$;
REVOKE ALL ON FUNCTION public.place_shop_order(UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- Fail closed in the legacy write trigger too: NULL role comparisons must never authorize a write.
CREATE OR REPLACE FUNCTION public.enforce_rbac_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_role public.user_role;
BEGIN
    IF (SELECT auth.uid()) IS NULL THEN RETURN NEW; END IF;
    v_role := public.current_user_role();
    IF v_role = 'admin' THEN RETURN NEW; END IF;

    IF TG_TABLE_NAME = 'practitioner_details' THEN
        IF v_role IS DISTINCT FROM 'practitioner' OR NEW.id <> (SELECT auth.uid()) THEN
            RAISE EXCEPTION 'Only practitioners may update their own details';
        END IF;
    ELSIF TG_TABLE_NAME = 'consultations' THEN
        IF TG_OP = 'UPDATE' THEN
            IF v_role = 'patient' AND OLD.patient_id = (SELECT auth.uid())
               AND OLD.booking_status = 'pending_payment' AND OLD.payment_expires_at <= NOW()
               AND NEW.booking_status = 'cancelled' AND NEW.status = 'cancelled'
               AND (to_jsonb(NEW) - ARRAY['status', 'booking_status']) IS NOT DISTINCT FROM
                   (to_jsonb(OLD) - ARRAY['status', 'booking_status']) THEN
                RETURN NEW;
            END IF;
            IF v_role IS DISTINCT FROM 'practitioner' OR OLD.doctor_id <> (SELECT auth.uid())
               OR NEW.doctor_id <> OLD.doctor_id
               OR (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') THEN
                RAISE EXCEPTION 'Practitioners may only update status on their own consultations';
            END IF;
            RETURN NEW;
        END IF;
        IF v_role IS DISTINCT FROM 'patient' OR NEW.patient_id <> (SELECT auth.uid()) THEN
            RAISE EXCEPTION 'Only patients may initiate their own consultations';
        END IF;
    ELSIF TG_TABLE_NAME = 'orders' THEN
        IF v_role IS DISTINCT FROM 'patient' OR NEW.customer_id <> (SELECT auth.uid()) THEN
            RAISE EXCEPTION 'Only active patients may place their own orders';
        END IF;
    ELSIF TG_TABLE_NAME = 'program_progress_logs' THEN
        IF TG_OP = 'UPDATE' AND v_role = 'practitioner'
           AND (to_jsonb(NEW) - 'dietitian_feedback') IS NOT DISTINCT FROM
               (to_jsonb(OLD) - 'dietitian_feedback') THEN
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'Practitioners may only update assigned feedback';
    ELSIF TG_TABLE_NAME = 'consultation_slots' THEN
        IF v_role = 'practitioner' AND NEW.practitioner_id = (SELECT auth.uid())
           AND (TG_OP = 'INSERT' OR (NOT OLD.is_booked AND NOT NEW.is_booked
             AND NEW.consultation_id IS NOT DISTINCT FROM OLD.consultation_id)) THEN
            RETURN NEW;
        END IF;
        IF v_role = 'patient' AND TG_OP = 'UPDATE' AND OLD.is_booked AND NOT NEW.is_booked
           AND NEW.consultation_id IS NULL
           AND EXISTS (SELECT 1 FROM public.consultations c
               WHERE c.id = OLD.consultation_id AND c.patient_id = (SELECT auth.uid())
                 AND c.booking_status = 'cancelled' AND c.payment_expires_at <= NOW()) THEN
            RETURN NEW;
        END IF;
        IF v_role = 'patient' AND TG_OP = 'UPDATE' AND NOT OLD.is_booked AND NEW.is_booked
           AND EXISTS (SELECT 1 FROM public.consultations c
               WHERE c.id = NEW.consultation_id AND c.slot_id = OLD.id
                 AND c.patient_id = (SELECT auth.uid())
                 AND c.booking_status = 'pending_payment') THEN
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'Not authorized to change this consultation slot';
    ELSE
        RAISE EXCEPTION 'Not authorized to write %', TG_TABLE_NAME;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_rbac_write() FROM PUBLIC, anon, authenticated;

-- Store push credentials separately from clinical profiles. Practitioners cannot read this table.
CREATE TABLE public.patient_push_tokens (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    expo_push_token TEXT NOT NULL UNIQUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.patient_push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage only their own push token" ON public.patient_push_tokens
    FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()) AND public.current_user_role() IS NOT NULL)
    WITH CHECK (user_id = (SELECT auth.uid()) AND public.current_user_role() IS NOT NULL);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_push_tokens TO authenticated;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS expo_push_token;

-- A retried booking request returns the same pending booking instead of creating a second chargeable slot.
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS payment_expires_at TIMESTAMPTZ;
UPDATE public.consultations SET payment_expires_at = created_at + INTERVAL '30 minutes'
WHERE booking_status = 'pending_payment' AND payment_expires_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS one_open_booking_per_slot
    ON public.consultations (slot_id)
    WHERE slot_id IS NOT NULL AND booking_status IN ('pending_payment', 'confirmed');

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
BEGIN
    IF auth.uid() IS DISTINCT FROM p_patient_id THEN RAISE EXCEPTION 'Patient ID must match the authenticated user'; END IF;
    IF public.current_user_role() IS DISTINCT FROM 'patient' THEN RAISE EXCEPTION 'Only active patients can book consultations'; END IF;
    IF p_chief_complaint IS NULL OR btrim(p_chief_complaint) = '' THEN RAISE EXCEPTION 'Chief complaint is required'; END IF;

    SELECT c.* INTO v_consultation FROM public.consultations AS c
    WHERE c.slot_id = p_slot_id AND c.patient_id = p_patient_id
      AND c.booking_status = 'pending_payment' AND c.payment_expires_at > NOW()
    FOR UPDATE;
    IF FOUND THEN
        v_total_paise := round(v_consultation.amount_inr * 100)::BIGINT;
        v_fee_paise := round(v_total_paise / 1.18)::BIGINT;
        v_gst_paise := v_total_paise - v_fee_paise;
        RETURN QUERY SELECT v_consultation, COALESCE(v_consultation.payment_order_id, 'pending'),
            v_fee_paise, v_gst_paise, v_total_paise;
        RETURN;
    END IF;

    SELECT c.* INTO v_consultation FROM public.consultations AS c
    WHERE c.slot_id = p_slot_id AND c.patient_id = p_patient_id
      AND c.booking_status = 'pending_payment' AND c.payment_expires_at <= NOW()
    FOR UPDATE;
    IF FOUND THEN
        UPDATE public.consultations SET booking_status = 'cancelled', status = 'cancelled'
        WHERE id = v_consultation.id AND booking_status = 'pending_payment';
        UPDATE public.consultation_slots SET is_booked = FALSE, consultation_id = NULL
        WHERE id = p_slot_id AND consultation_id = v_consultation.id;
        UPDATE public.razorpay_order_logs SET status = 'superseded'
        WHERE entity_type = 'consultation' AND entity_id = v_consultation.id AND status = 'created';
    END IF;

    SELECT * INTO v_slot FROM public.consultation_slots WHERE id = p_slot_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Consultation slot not found'; END IF;
    IF v_slot.is_booked THEN
        SELECT c.* INTO v_consultation FROM public.consultations AS c
        WHERE c.slot_id = p_slot_id AND c.patient_id = p_patient_id
          AND c.booking_status = 'pending_payment' AND c.payment_expires_at > NOW()
        FOR UPDATE;
        IF FOUND THEN
            v_total_paise := round(v_consultation.amount_inr * 100)::BIGINT;
            v_fee_paise := round(v_total_paise / 1.18)::BIGINT;
            v_gst_paise := v_total_paise - v_fee_paise;
            RETURN QUERY SELECT v_consultation, COALESCE(v_consultation.payment_order_id, 'pending'),
                v_fee_paise, v_gst_paise, v_total_paise;
            RETURN;
        END IF;
        RAISE EXCEPTION 'Consultation slot is already held or booked';
    END IF;
    IF v_slot.start_time <= NOW() THEN RAISE EXCEPTION 'Consultation slot must be in the future'; END IF;

    SELECT pd.consultation_fee_inr INTO v_fee_inr FROM public.practitioner_details AS pd
    WHERE pd.id = v_slot.practitioner_id AND pd.is_active;
    IF NOT FOUND OR v_fee_inr IS NULL THEN RAISE EXCEPTION 'Practitioner is not accepting consultations'; END IF;
    v_fee_paise := round(v_fee_inr * 100)::BIGINT;
    v_gst_paise := round(v_fee_paise * 0.18)::BIGINT;
    v_total_paise := v_fee_paise + v_gst_paise;

    INSERT INTO public.consultations (
        patient_id, doctor_id, slot_start, slot_end, status, chief_complaint,
        booking_status, slot_id, amount_inr, payment_expires_at
    ) VALUES (
        p_patient_id, v_slot.practitioner_id, v_slot.start_time, v_slot.end_time, 'scheduled',
        btrim(p_chief_complaint), 'pending_payment', p_slot_id, v_total_paise / 100.0,
        LEAST(NOW() + INTERVAL '30 minutes', v_slot.start_time)
    ) RETURNING * INTO v_consultation;

    UPDATE public.consultation_slots SET is_booked = TRUE, consultation_id = v_consultation.id
    WHERE id = p_slot_id AND NOT is_booked;
    IF NOT FOUND THEN RAISE EXCEPTION 'Consultation slot is already held or booked'; END IF;

    RETURN QUERY SELECT v_consultation, 'pending'::TEXT, v_fee_paise, v_gst_paise, v_total_paise;
END;
$$;
REVOKE ALL ON FUNCTION public.initiate_consultation_booking(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.initiate_consultation_booking(UUID, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.expire_pending_consultations(p_limit INT DEFAULT 100)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_booking public.consultations;
    v_expired INT := 0;
BEGIN
    FOR v_booking IN
        SELECT * FROM public.consultations
        WHERE booking_status = 'pending_payment' AND payment_expires_at <= NOW()
        ORDER BY payment_expires_at
        LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 500))
        FOR UPDATE SKIP LOCKED
    LOOP
        UPDATE public.consultations SET booking_status = 'cancelled', status = 'cancelled'
        WHERE id = v_booking.id AND booking_status = 'pending_payment';
        UPDATE public.consultation_slots SET is_booked = FALSE, consultation_id = NULL
        WHERE id = v_booking.slot_id AND consultation_id = v_booking.id;
        UPDATE public.razorpay_order_logs SET status = 'superseded'
        WHERE entity_type = 'consultation' AND entity_id = v_booking.id AND status = 'created';
        v_expired := v_expired + 1;
    END LOOP;
    RETURN v_expired;
END;
$$;
REVOKE ALL ON FUNCTION public.expire_pending_consultations(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_pending_consultations(INT) TO service_role;

-- A pending shop order holds inventory for 30 minutes. The release timestamp and order lock make
-- expiry exactly-once; a released/cancelled order can no longer be paid by the payment endpoint.
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS reservation_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS stock_released_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS checkout_idempotency_key UUID,
    ADD COLUMN IF NOT EXISTS checkout_fingerprint TEXT;
UPDATE public.orders SET reservation_expires_at = created_at + INTERVAL '30 minutes'
WHERE status = 'pending' AND reservation_expires_at IS NULL;
CREATE INDEX IF NOT EXISTS pending_shop_order_expiry_idx
    ON public.orders (reservation_expires_at)
    WHERE status = 'pending' AND stock_released_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS one_order_per_checkout_key
    ON public.orders (customer_id, checkout_idempotency_key)
    WHERE checkout_idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.release_shop_stock_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF OLD.status = 'pending' AND NEW.status = 'cancelled' AND OLD.stock_released_at IS NULL THEN
        UPDATE public.products AS product
        SET stock_count = product.stock_count + item.quantity
        FROM public.order_items AS item
        WHERE item.order_id = NEW.id AND item.product_id = product.id;
        UPDATE public.razorpay_order_logs
        SET status = 'superseded'
        WHERE entity_type = 'shop_order' AND entity_id = NEW.id AND status = 'created';
        NEW.stock_released_at := NOW();
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.release_shop_stock_on_cancel() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS release_shop_stock_on_cancel ON public.orders;
CREATE TRIGGER release_shop_stock_on_cancel
    BEFORE UPDATE OF status ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.release_shop_stock_on_cancel();

CREATE OR REPLACE FUNCTION public.expire_pending_shop_orders(p_limit INT DEFAULT 100)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_order public.orders;
    v_expired INT := 0;
BEGIN
    FOR v_order IN
        SELECT * FROM public.orders
        WHERE status = 'pending' AND stock_released_at IS NULL
          AND reservation_expires_at <= NOW()
        ORDER BY reservation_expires_at
        LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 500))
        FOR UPDATE SKIP LOCKED
    LOOP
        UPDATE public.orders
        SET status = 'cancelled'
        WHERE id = v_order.id AND status = 'pending' AND stock_released_at IS NULL;
        IF FOUND THEN v_expired := v_expired + 1; END IF;
    END LOOP;
    RETURN v_expired;
END;
$$;
REVOKE ALL ON FUNCTION public.expire_pending_shop_orders(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_pending_shop_orders(INT) TO service_role;

-- Reuse one active Razorpay order per payable entity. Historical duplicates are superseded first.
UPDATE public.razorpay_order_logs SET status = 'superseded'
WHERE status = 'created' AND order_id LIKE 'order_mock\_%' ESCAPE '\';
WITH ranked AS (
    SELECT id, row_number() OVER (
        PARTITION BY user_id, entity_type, entity_id
        ORDER BY CASE WHEN status = 'captured' THEN 0 ELSE 1 END, created_at DESC, id DESC
    ) AS position
    FROM public.razorpay_order_logs WHERE status IN ('created', 'captured')
)
UPDATE public.razorpay_order_logs AS log
SET status = 'superseded'
FROM ranked WHERE ranked.id = log.id AND ranked.position > 1;
CREATE UNIQUE INDEX IF NOT EXISTS one_active_razorpay_order_per_entity
    ON public.razorpay_order_logs (user_id, entity_type, entity_id)
    WHERE status IN ('created', 'captured');

-- Retrying a captured program payment reuses the active enrollment; a later repurchase first closes
-- the previous expired row so the existing one-active-enrollment index remains correct.
ALTER TABLE public.razorpay_order_logs
    ADD COLUMN program_enrolment_id UUID REFERENCES public.program_enrolments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS razorpay_order_logs_program_enrolment_idx
    ON public.razorpay_order_logs (program_enrolment_id)
    WHERE program_enrolment_id IS NOT NULL;

-- Reconcile legacy captures where the old webhook committed an enrollment but left the payment log
-- in `captured`. Match only the nearest enrollment created shortly after the matching captured
-- transaction, and only one payment to one enrollment. Unmatched captured payments are quarantined
-- for refund review instead of being allowed to create a second term on webhook replay.
WITH candidates AS (
    SELECT
        log.id AS order_log_id,
        enrolment.id AS enrolment_id,
        row_number() OVER (
            PARTITION BY log.id
            ORDER BY abs(extract(epoch FROM (enrolment.created_at - transaction.created_at))),
                     enrolment.created_at, enrolment.id
        ) AS order_rank,
        row_number() OVER (
            PARTITION BY enrolment.id
            ORDER BY abs(extract(epoch FROM (enrolment.created_at - transaction.created_at))),
                     transaction.created_at DESC, log.id
        ) AS enrolment_rank
    FROM public.razorpay_order_logs AS log
    JOIN public.payment_transactions AS transaction
      ON transaction.gateway_order_id = log.order_id
     AND transaction.gateway = 'razorpay'
     AND transaction.status = 'captured'
    JOIN public.program_enrolments AS enrolment
      ON enrolment.patient_id = log.user_id
     AND enrolment.program_id = log.entity_id
     AND enrolment.created_at >= transaction.created_at
     AND enrolment.created_at <= transaction.created_at + INTERVAL '15 minutes'
    WHERE log.entity_type = 'program'
      AND log.status IN ('captured', 'superseded')
), matched AS (
    SELECT order_log_id, enrolment_id
    FROM candidates
    WHERE order_rank = 1 AND enrolment_rank = 1
)
UPDATE public.razorpay_order_logs AS log
SET program_enrolment_id = matched.enrolment_id,
    status = 'fulfilled'
FROM matched
WHERE matched.order_log_id = log.id;

UPDATE public.razorpay_order_logs AS log
SET status = 'refund_review'
WHERE log.status = 'superseded'
  AND EXISTS (
      SELECT 1 FROM public.payment_transactions AS transaction
      WHERE transaction.gateway = 'razorpay'
        AND transaction.gateway_order_id = log.order_id
        AND transaction.status = 'captured'
  );
UPDATE public.razorpay_order_logs AS log
SET status = 'refund_review'
WHERE log.entity_type = 'program'
  AND log.status = 'captured'
  AND log.program_enrolment_id IS NULL
  AND EXISTS (
      SELECT 1 FROM public.payment_transactions AS transaction
      WHERE transaction.gateway = 'razorpay'
        AND transaction.gateway_order_id = log.order_id
        AND transaction.status = 'captured'
  );

CREATE TABLE public.payment_refund_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gateway_payment_id TEXT NOT NULL UNIQUE
        REFERENCES public.payment_transactions(gateway_payment_id) ON DELETE CASCADE,
    gateway_order_id TEXT NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
    refund_id TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);
ALTER TABLE public.payment_refund_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read payment refund reviews"
    ON public.payment_refund_reviews
    FOR SELECT TO authenticated
    USING ((SELECT public.current_user_role()) = 'admin'::public.user_role);
GRANT SELECT ON public.payment_refund_reviews TO authenticated;
GRANT ALL ON public.payment_refund_reviews TO service_role;
CREATE OR REPLACE FUNCTION public.record_payment_refund_review(
    p_gateway_payment_id TEXT,
    p_refund_id TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_review_id UUID;
    v_gateway_order_id TEXT;
    v_gateway_payment_id TEXT;
BEGIN
    IF public.current_user_role() IS DISTINCT FROM 'admin'::public.user_role THEN
        RAISE EXCEPTION 'Only admins can resolve payment refund reviews';
    END IF;
    IF p_gateway_payment_id IS NULL OR btrim(p_gateway_payment_id) = ''
       OR p_refund_id IS NULL OR btrim(p_refund_id) = '' OR length(btrim(p_refund_id)) > 128 THEN
        RAISE EXCEPTION 'Payment and refund IDs are required';
    END IF;

    UPDATE public.payment_refund_reviews
    SET status = 'resolved', refund_id = btrim(p_refund_id), resolved_at = NOW()
    WHERE gateway_payment_id = p_gateway_payment_id AND status = 'pending'
    RETURNING id, gateway_order_id, gateway_payment_id
      INTO v_review_id, v_gateway_order_id, v_gateway_payment_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pending refund review not found'; END IF;

    UPDATE public.payment_transactions
    SET status = 'refunded'
    WHERE gateway_payment_id = v_gateway_payment_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Payment transaction no longer exists'; END IF;

    UPDATE public.razorpay_order_logs
    SET status = 'refunded'
    WHERE order_id = v_gateway_order_id AND status = 'refund_review';
    RETURN v_review_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_payment_refund_review(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_payment_refund_review(TEXT, TEXT) TO authenticated;
CREATE INDEX payment_refund_reviews_pending_idx
    ON public.payment_refund_reviews (created_at DESC)
    WHERE status = 'pending';
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'payment_refund_reviews'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_refund_reviews;
    END IF;
END;
$$;
INSERT INTO public.payment_refund_reviews (gateway_payment_id, gateway_order_id, user_id, reason)
SELECT transaction.gateway_payment_id, log.order_id, log.user_id,
       'A captured payment has no safely matched fulfillment and needs manual refund review.'
FROM public.payment_transactions AS transaction
JOIN public.razorpay_order_logs AS log ON log.order_id = transaction.gateway_order_id
WHERE transaction.gateway = 'razorpay'
  AND transaction.status = 'captured'
  AND transaction.gateway_payment_id IS NOT NULL
  AND log.status = 'refund_review'
ON CONFLICT (gateway_payment_id) DO NOTHING;

REVOKE ALL ON public.payment_transactions FROM anon, authenticated;
GRANT SELECT ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;
CREATE POLICY "Admins read payment transactions"
    ON public.payment_transactions
    FOR SELECT TO authenticated
    USING ((SELECT public.current_user_role()) = 'admin'::public.user_role);

CREATE OR REPLACE FUNCTION public.preserve_refunded_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF OLD.status = 'refunded' AND NEW.status IS DISTINCT FROM 'refunded' THEN
        NEW.status := 'refunded';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.preserve_refunded_payment_status() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS preserve_refunded_payment_status ON public.payment_transactions;
CREATE TRIGGER preserve_refunded_payment_status
    BEFORE UPDATE OF status ON public.payment_transactions
    FOR EACH ROW EXECUTE FUNCTION public.preserve_refunded_payment_status();

CREATE OR REPLACE FUNCTION public.fulfill_program_enrolment(
    p_patient_id UUID,
    p_program_id UUID,
    p_order_id TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_program public.programs;
    v_order public.razorpay_order_logs;
    v_enrolment_id UUID;
BEGIN
    IF p_patient_id IS NULL OR p_program_id IS NULL OR p_order_id IS NULL OR btrim(p_order_id) = '' THEN
        RAISE EXCEPTION 'Patient, program, and payment order are required';
    END IF;

    SELECT * INTO v_order
    FROM public.razorpay_order_logs
    WHERE order_id = p_order_id
    FOR UPDATE;
    IF NOT FOUND
       OR v_order.user_id IS DISTINCT FROM p_patient_id
       OR v_order.entity_type IS DISTINCT FROM 'program'
       OR v_order.entity_id IS DISTINCT FROM p_program_id
       OR v_order.status NOT IN ('captured', 'fulfilled') THEN
        RAISE EXCEPTION 'Captured payment order does not match the program enrollment';
    END IF;

    -- The enrollment and this link/status update commit in one transaction. Retries therefore
    -- return the same row even if it has since expired or the Edge Function crashed afterward.
    IF v_order.program_enrolment_id IS NOT NULL THEN
        RETURN v_order.program_enrolment_id;
    END IF;

    SELECT * INTO v_program FROM public.programs WHERE id = p_program_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Program no longer exists'; END IF;

    SELECT id INTO v_enrolment_id FROM public.program_enrolments
    WHERE patient_id = p_patient_id AND program_id = p_program_id
      AND status = 'active' AND expires_at > NOW()
    LIMIT 1 FOR UPDATE;
    IF FOUND THEN
        UPDATE public.razorpay_order_logs
        SET program_enrolment_id = v_enrolment_id, status = 'fulfilled'
        WHERE id = v_order.id;
        RETURN v_enrolment_id;
    END IF;

    UPDATE public.program_enrolments SET status = 'completed'
    WHERE patient_id = p_patient_id AND program_id = p_program_id
      AND status = 'active' AND expires_at <= NOW();

    INSERT INTO public.program_enrolments (patient_id, program_id, started_at, expires_at, status)
    VALUES (
        p_patient_id, p_program_id, NOW(), NOW() + make_interval(days => v_program.duration_days), 'active'
    ) RETURNING id INTO v_enrolment_id;

    UPDATE public.razorpay_order_logs
    SET program_enrolment_id = v_enrolment_id, status = 'fulfilled'
    WHERE id = v_order.id;
    RETURN v_enrolment_id;
END;
$$;
REVOKE ALL ON FUNCTION public.fulfill_program_enrolment(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_program_enrolment(UUID, UUID, TEXT) TO service_role;

-- Add the reservation deadline to the server-created order in the same transaction as its stock decrement.
REVOKE ALL ON FUNCTION public.create_mobile_order(TEXT, JSONB) FROM PUBLIC, anon, authenticated;
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
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(v_customer::TEXT || ':' || p_idempotency_key::TEXT, 0)
    );
    SELECT o.id, o.checkout_fingerprint INTO v_order_id, v_existing_fingerprint
    FROM public.orders AS o
    WHERE o.customer_id = v_customer AND o.checkout_idempotency_key = p_idempotency_key
    FOR UPDATE;
    IF FOUND THEN
        IF v_existing_fingerprint IS DISTINCT FROM v_checkout_fingerprint THEN
            RAISE EXCEPTION 'Checkout idempotency key was already used for different details';
        END IF;
        RETURN v_order_id;
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
        SELECT o.id, o.checkout_fingerprint INTO v_order_id, v_existing_fingerprint
        FROM public.orders AS o
        WHERE o.customer_id = v_customer AND o.checkout_idempotency_key = p_idempotency_key
        FOR UPDATE;
        IF NOT FOUND OR v_existing_fingerprint IS DISTINCT FROM v_checkout_fingerprint THEN
            RAISE EXCEPTION 'Checkout idempotency key could not be resolved';
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

-- Supabase projects provide pg_cron. Run the same idempotent database release path every five minutes.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'healthoraa-expire-shop-orders';
SELECT cron.schedule(
    'healthoraa-expire-shop-orders',
    '*/5 * * * *',
    $job$SELECT public.expire_pending_shop_orders(500);$job$
);
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'healthoraa-expire-pending-consultations';
SELECT cron.schedule(
    'healthoraa-expire-pending-consultations',
    '*/5 * * * *',
    $job$SELECT public.expire_pending_consultations(500);$job$
);
