-- Admins can record a provider refund reference, but provider evidence alone closes the review.
ALTER TABLE public.payment_refund_reviews
    ADD COLUMN manual_refund_reference TEXT,
    ADD COLUMN manual_refund_recorded_by UUID,
    ADD COLUMN manual_refund_recorded_at TIMESTAMPTZ;

-- Older admin resolutions were only attestations. Reopen them unless processed provider
-- refunds in the durable event ledger cover the captured amount.
WITH refund_evidence AS (
    SELECT review.id AS review_id,
           review.gateway_payment_id,
           review.refund_id,
           review.resolved_at,
           EXISTS (
               SELECT 1
               FROM public.razorpay_refund_events AS recorded
               WHERE recorded.gateway_payment_id = review.gateway_payment_id
                 AND recorded.refund_id = review.refund_id
           ) AS refund_id_has_provider_event
    FROM public.payment_refund_reviews AS review
    JOIN public.payment_transactions AS transaction
      ON transaction.gateway_payment_id = review.gateway_payment_id
    LEFT JOIN LATERAL (
        SELECT SUM(event.amount_paise) FILTER (WHERE event.status = 'processed') AS processed_paise
        FROM public.razorpay_refund_events AS event
        WHERE event.gateway_payment_id = review.gateway_payment_id
    ) AS event_totals ON TRUE
    WHERE review.status = 'resolved'
      AND COALESCE(event_totals.processed_paise, 0) < round(transaction.amount_inr * 100)::BIGINT
), reopened AS (
    UPDATE public.payment_refund_reviews AS review
    SET status = 'pending',
        resolved_at = NULL,
        refund_id = CASE WHEN evidence.refund_id_has_provider_event THEN review.refund_id ELSE NULL END,
        manual_refund_reference = COALESCE(
            review.manual_refund_reference,
            CASE WHEN evidence.refund_id_has_provider_event THEN NULL ELSE evidence.refund_id END
        ),
        manual_refund_recorded_at = COALESCE(
            review.manual_refund_recorded_at,
            CASE WHEN review.manual_refund_reference IS NULL
                       AND NOT evidence.refund_id_has_provider_event
                       AND evidence.refund_id IS NOT NULL
                 THEN evidence.resolved_at ELSE NULL END
        ),
        automatic_refund_state = 'manual',
        reason = review.reason || ' A previous admin resolution was reopened because processed Razorpay refund events do not cover the captured amount.'
    FROM refund_evidence AS evidence
    WHERE review.id = evidence.review_id
    RETURNING review.gateway_payment_id
)
UPDATE public.payment_transactions AS transaction
SET status = 'refund_review'
WHERE transaction.status = 'refunded'
  AND transaction.gateway_payment_id IN (SELECT reopened.gateway_payment_id FROM reopened);

UPDATE public.razorpay_order_logs AS order_log
SET status = 'refund_review'
WHERE order_log.status = 'refunded'
  AND EXISTS (
      SELECT 1
      FROM public.payment_refund_reviews AS review
      WHERE review.gateway_payment_id = order_log.captured_payment_id
        AND review.gateway_order_id = order_log.order_id
        AND review.status = 'pending'
  );

-- Serialize capture audit writes with refund-event recording and never downgrade an
-- existing refund hold from a delayed duplicate capture webhook.
CREATE OR REPLACE FUNCTION public.record_razorpay_payment_capture(
    p_gateway_payment_id TEXT,
    p_gateway_order_id TEXT,
    p_amount_inr NUMERIC,
    p_currency TEXT,
    p_status public.payment_status,
    p_error_code TEXT,
    p_error_description TEXT,
    p_order_id UUID,
    p_consultation_id UUID
)
RETURNS public.payment_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_status public.payment_status;
BEGIN
    IF p_gateway_payment_id IS NULL OR btrim(p_gateway_payment_id) = ''
       OR p_gateway_order_id IS NULL OR btrim(p_gateway_order_id) = ''
       OR p_amount_inr IS NULL OR p_amount_inr <= 0
       OR p_currency IS NULL OR btrim(p_currency) = ''
       OR p_status IS NULL
       OR p_status NOT IN ('captured', 'failed', 'refunded', 'refund_review') THEN
        RETURN NULL;
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_gateway_payment_id, 0));
    INSERT INTO public.payment_transactions AS current_payment (
        gateway,
        gateway_payment_id,
        gateway_order_id,
        amount_inr,
        currency,
        status,
        error_code,
        error_description,
        order_id,
        consultation_id
    ) VALUES (
        'razorpay'::public.payment_gateway,
        p_gateway_payment_id,
        p_gateway_order_id,
        p_amount_inr,
        p_currency,
        p_status,
        p_error_code,
        p_error_description,
        p_order_id,
        p_consultation_id
    )
    ON CONFLICT (gateway_payment_id) DO UPDATE
    SET status = CASE
            WHEN current_payment.status IN ('refunded', 'refund_review')
                THEN current_payment.status
            WHEN current_payment.status = 'captured'::public.payment_status
                 AND EXCLUDED.status = 'failed'::public.payment_status
                THEN 'captured'::public.payment_status
            ELSE EXCLUDED.status
        END,
        error_code = EXCLUDED.error_code,
        error_description = EXCLUDED.error_description
    WHERE current_payment.gateway = 'razorpay'::public.payment_gateway
      AND current_payment.gateway_order_id = EXCLUDED.gateway_order_id
      AND current_payment.amount_inr = EXCLUDED.amount_inr
      AND current_payment.currency = EXCLUDED.currency
      AND current_payment.order_id IS NOT DISTINCT FROM EXCLUDED.order_id
      AND current_payment.consultation_id IS NOT DISTINCT FROM EXCLUDED.consultation_id
    RETURNING current_payment.status INTO v_status;

    RETURN v_status;
END;
$$;
REVOKE ALL ON FUNCTION public.record_razorpay_payment_capture(TEXT, TEXT, NUMERIC, TEXT, public.payment_status, TEXT, TEXT, UUID, UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_razorpay_payment_capture(TEXT, TEXT, NUMERIC, TEXT, public.payment_status, TEXT, TEXT, UUID, UUID)
    TO service_role;

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
    v_captured_payment_id TEXT;
BEGIN
    IF p_patient_id IS NULL OR p_program_id IS NULL OR p_order_id IS NULL OR btrim(p_order_id) = '' THEN
        RAISE EXCEPTION 'Patient, program, and payment order are required';
    END IF;

    SELECT captured_payment_id INTO v_captured_payment_id
    FROM public.razorpay_order_logs
    WHERE order_id = p_order_id;
    IF NOT FOUND OR v_captured_payment_id IS NULL THEN
        RAISE EXCEPTION 'Captured payment ID is missing for program fulfillment';
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_captured_payment_id, 0));
    PERFORM 1
    FROM public.payment_transactions
    WHERE gateway = 'razorpay'::public.payment_gateway
      AND gateway_payment_id = v_captured_payment_id
      AND gateway_order_id = p_order_id
      AND status = 'captured'::public.payment_status
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Captured payment transaction does not match the program order'; END IF;

    SELECT * INTO v_order
    FROM public.razorpay_order_logs
    WHERE order_id = p_order_id
    FOR UPDATE;
    IF NOT FOUND
       OR v_order.user_id IS DISTINCT FROM p_patient_id
       OR v_order.entity_type IS DISTINCT FROM 'program'
       OR v_order.entity_id IS DISTINCT FROM p_program_id
       OR v_order.captured_payment_id IS DISTINCT FROM v_captured_payment_id
       OR v_order.status NOT IN ('captured', 'fulfilled') THEN
        RAISE EXCEPTION 'Captured payment order does not match the program enrollment';
    END IF;

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
        INSERT INTO public.payment_refund_reviews (gateway_payment_id, gateway_order_id, user_id, reason)
        VALUES (
            v_order.captured_payment_id,
            p_order_id,
            p_patient_id,
            'A programme payment was captured while an active enrolment already existed. No additional term was granted; refund review is required.'
        )
        ON CONFLICT (gateway_payment_id) DO NOTHING;
        UPDATE public.razorpay_order_logs SET status = 'refund_review' WHERE id = v_order.id;
        RETURN NULL;
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

-- Keep the capture confirmation lock fix in a forward migration so databases that
-- already applied the first reconciliation migration receive the same protection.
CREATE OR REPLACE FUNCTION public.confirm_consultation_payment_capture(
    p_consultation_id UUID,
    p_patient_id UUID,
    p_order_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_payment_id TEXT;
BEGIN
    SELECT order_log.captured_payment_id
    INTO v_payment_id
    FROM public.razorpay_order_logs AS order_log
    WHERE order_log.order_id = p_order_id
      AND order_log.entity_type = 'consultation'
      AND order_log.entity_id = p_consultation_id
      AND order_log.user_id = p_patient_id;
    IF NOT FOUND OR v_payment_id IS NULL THEN RETURN FALSE; END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_payment_id, 0));
    PERFORM 1
    FROM public.payment_transactions AS transaction
    WHERE transaction.gateway_payment_id = v_payment_id
      AND transaction.gateway = 'razorpay'::public.payment_gateway
      AND transaction.gateway_order_id = p_order_id
      AND transaction.consultation_id = p_consultation_id
      AND transaction.status = 'captured'::public.payment_status
    FOR UPDATE;
    IF NOT FOUND THEN RETURN FALSE; END IF;

    UPDATE public.consultations
    SET booking_status = 'confirmed'
    WHERE id = p_consultation_id
      AND patient_id = p_patient_id
      AND payment_order_id = p_order_id
      AND booking_status = 'pending_payment'
      AND payment_expires_at > clock_timestamp();
    RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_consultation_payment_capture(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_consultation_payment_capture(UUID, UUID, TEXT) TO service_role;

DROP FUNCTION IF EXISTS public.confirm_shop_order_payment_capture(UUID, UUID);
CREATE OR REPLACE FUNCTION public.confirm_shop_order_payment_capture(
    p_order_id UUID,
    p_patient_id UUID,
    p_gateway_order_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_payment_id TEXT;
BEGIN
    SELECT order_log.captured_payment_id
    INTO v_payment_id
    FROM public.razorpay_order_logs AS order_log
    WHERE order_log.order_id = p_gateway_order_id
      AND order_log.entity_type = 'shop_order'
      AND order_log.entity_id = p_order_id
      AND order_log.user_id = p_patient_id;
    IF NOT FOUND OR v_payment_id IS NULL THEN RETURN FALSE; END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_payment_id, 0));
    PERFORM 1
    FROM public.payment_transactions AS transaction
    WHERE transaction.gateway_payment_id = v_payment_id
      AND transaction.gateway = 'razorpay'::public.payment_gateway
      AND transaction.gateway_order_id = p_gateway_order_id
      AND transaction.order_id = p_order_id
      AND transaction.status = 'captured'::public.payment_status
    FOR UPDATE;
    IF NOT FOUND THEN RETURN FALSE; END IF;

    UPDATE public.orders
    SET status = 'paid'
    WHERE id = p_order_id
      AND customer_id = p_patient_id
      AND status = 'pending'
      AND stock_released_at IS NULL
      AND reservation_expires_at > clock_timestamp();
    RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_shop_order_payment_capture(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_shop_order_payment_capture(UUID, UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.reconcile_razorpay_refunds(p_gateway_payment_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_amount_paise BIGINT;
    v_order_id TEXT;
    v_user_id UUID;
    v_processed_paise BIGINT := 0;
    v_pending_count BIGINT := 0;
    v_failed_count BIGINT := 0;
    v_has_events BOOLEAN := FALSE;
    v_reason TEXT;
    v_review_status TEXT;
    v_automatic_refund_state TEXT;
    v_latest_refund_id TEXT;
BEGIN
    IF p_gateway_payment_id IS NULL OR btrim(p_gateway_payment_id) = '' THEN
        RETURN 'unmatched';
    END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_gateway_payment_id, 0));

    SELECT round(transaction.amount_inr * 100)::BIGINT, transaction.gateway_order_id
    INTO v_amount_paise, v_order_id
    FROM public.payment_transactions AS transaction
    WHERE transaction.gateway_payment_id = p_gateway_payment_id
    FOR UPDATE;
    IF NOT FOUND OR v_order_id IS NULL THEN RETURN 'unmatched'; END IF;

    SELECT
        COALESCE(sum(event.amount_paise) FILTER (WHERE event.status = 'processed'), 0),
        count(*) FILTER (WHERE event.status = 'created'),
        count(*) FILTER (WHERE event.status = 'failed'),
        count(*) > 0
    INTO v_processed_paise, v_pending_count, v_failed_count, v_has_events
    FROM public.razorpay_refund_events AS event
    WHERE event.gateway_payment_id = p_gateway_payment_id;
    IF NOT v_has_events THEN RETURN 'none'; END IF;

    SELECT event.refund_id INTO v_latest_refund_id
    FROM public.razorpay_refund_events AS event
    WHERE event.gateway_payment_id = p_gateway_payment_id
    ORDER BY event.updated_at DESC, event.refund_id
    LIMIT 1;

    SELECT order_log.user_id INTO v_user_id
    FROM public.razorpay_order_logs AS order_log
    WHERE order_log.order_id = v_order_id;

    IF v_processed_paise >= v_amount_paise THEN
        UPDATE public.payment_transactions
        SET status = 'refunded'
        WHERE gateway_payment_id = p_gateway_payment_id;
        UPDATE public.payment_refund_reviews
        SET status = 'resolved', resolved_at = COALESCE(resolved_at, NOW()),
            refund_id = COALESCE(refund_id, v_latest_refund_id),
            reason = format('Razorpay processed refunds totaling %s paise for this %s-paise payment.', v_processed_paise, v_amount_paise)
        WHERE gateway_payment_id = p_gateway_payment_id AND status = 'pending';
        -- A NULL captured_payment_id means this captured payment never owned the order log.
        -- Release that orphan hold after its own full provider refund, but preserve a different
        -- payment's hold when the log is already claimed by another captured payment.
        UPDATE public.razorpay_order_logs
        SET status = 'refunded'
        WHERE order_id = v_order_id
          AND (captured_payment_id IS NULL OR captured_payment_id = p_gateway_payment_id)
          AND status IN ('created', 'superseded', 'failed', 'captured', 'refund_review');
        RETURN 'refunded';
    END IF;

    IF v_processed_paise > 0 OR v_pending_count > 0 OR v_failed_count > 0 THEN
        v_reason := format(
            'Razorpay refund reconciliation: %s of %s paise processed; %s refund(s) pending and %s failed. Review the remaining balance.',
            v_processed_paise, v_amount_paise, v_pending_count, v_failed_count
        );
        IF v_user_id IS NULL THEN RETURN 'unmatched'; END IF;
        v_automatic_refund_state := CASE
            WHEN v_pending_count > 0 AND v_processed_paise = 0 AND v_failed_count = 0 THEN 'pending'
            ELSE 'manual'
        END;
        INSERT INTO public.payment_refund_reviews (
            gateway_payment_id, gateway_order_id, user_id, reason, refund_id, automatic_refund_state,
            last_reconciled_processed_paise, last_reconciled_pending_count, last_reconciled_failed_count
        ) VALUES (
            p_gateway_payment_id, v_order_id, v_user_id, v_reason, v_latest_refund_id, v_automatic_refund_state,
            v_processed_paise, v_pending_count, v_failed_count
        )
        ON CONFLICT (gateway_payment_id) DO UPDATE
        SET status = 'pending', resolved_at = NULL, reason = EXCLUDED.reason,
            refund_id = EXCLUDED.refund_id,
            automatic_refund_state = v_automatic_refund_state,
            last_reconciled_processed_paise = EXCLUDED.last_reconciled_processed_paise,
            last_reconciled_pending_count = EXCLUDED.last_reconciled_pending_count,
            last_reconciled_failed_count = EXCLUDED.last_reconciled_failed_count
        WHERE public.payment_refund_reviews.status = 'pending'
           OR public.payment_refund_reviews.last_reconciled_processed_paise IS DISTINCT FROM EXCLUDED.last_reconciled_processed_paise
           OR public.payment_refund_reviews.last_reconciled_pending_count IS DISTINCT FROM EXCLUDED.last_reconciled_pending_count
           OR public.payment_refund_reviews.last_reconciled_failed_count IS DISTINCT FROM EXCLUDED.last_reconciled_failed_count;
        SELECT review.status INTO v_review_status
        FROM public.payment_refund_reviews AS review
        WHERE review.gateway_payment_id = p_gateway_payment_id;
        IF v_review_status = 'resolved' THEN RETURN 'resolved'; END IF;
        UPDATE public.payment_transactions
        SET status = 'refund_review'
        WHERE gateway_payment_id = p_gateway_payment_id;
        UPDATE public.razorpay_order_logs
        SET status = 'refund_review'
        WHERE order_id = v_order_id
          AND captured_payment_id = p_gateway_payment_id
          AND status IN ('captured', 'refunded');
        IF v_processed_paise > 0 THEN RETURN 'partial_review'; END IF;
        IF v_pending_count > 0 THEN RETURN 'refund_pending'; END IF;
        RETURN 'refund_failed';
    END IF;
    RETURN 'none';
END;
$$;
REVOKE ALL ON FUNCTION public.reconcile_razorpay_refunds(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_razorpay_refunds(TEXT) TO service_role;

-- Record and reconcile each provider event while holding the payment lock. This prevents a
-- refund event from landing between the capture handler's reconciliation and confirmation RPC.
CREATE OR REPLACE FUNCTION public.record_and_reconcile_razorpay_refund_event(
    p_refund_id TEXT,
    p_gateway_payment_id TEXT,
    p_gateway_order_id TEXT,
    p_amount_paise BIGINT,
    p_status TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_transaction_order_id TEXT;
    v_payment_found BOOLEAN;
    v_event_recorded BOOLEAN;
BEGIN
    IF p_gateway_payment_id IS NULL OR btrim(p_gateway_payment_id) = '' THEN RETURN 'invalid'; END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_gateway_payment_id, 0));

    SELECT transaction.gateway_order_id
    INTO v_transaction_order_id
    FROM public.payment_transactions AS transaction
    WHERE transaction.gateway = 'razorpay'::public.payment_gateway
      AND transaction.gateway_payment_id = p_gateway_payment_id
    FOR UPDATE;
    v_payment_found := FOUND;

    IF v_payment_found AND p_gateway_order_id IS NOT NULL
       AND v_transaction_order_id IS DISTINCT FROM p_gateway_order_id THEN
        RAISE EXCEPTION 'Refund event order does not match captured payment';
    END IF;

    SELECT public.record_razorpay_refund_event(
        p_refund_id,
        p_gateway_payment_id,
        p_gateway_order_id,
        p_amount_paise,
        p_status
    ) INTO v_event_recorded;
    IF v_event_recorded IS DISTINCT FROM TRUE THEN RETURN 'invalid'; END IF;
    IF NOT v_payment_found THEN RETURN 'unmatched'; END IF;

    RETURN public.reconcile_razorpay_refunds(p_gateway_payment_id);
END;
$$;
REVOKE ALL ON FUNCTION public.record_and_reconcile_razorpay_refund_event(TEXT, TEXT, TEXT, BIGINT, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_and_reconcile_razorpay_refund_event(TEXT, TEXT, TEXT, BIGINT, TEXT)
    TO service_role;

-- Update the hold and its admin-visible review in one transaction. A failed review insert
-- must never leave an order blocked only by an invisible refund_review order-log state.
CREATE OR REPLACE FUNCTION public.record_captured_payment_refund_review(
    p_gateway_payment_id TEXT,
    p_gateway_order_id TEXT,
    p_user_id UUID,
    p_reason TEXT,
    p_preserve_fulfilled_order BOOLEAN DEFAULT FALSE,
    p_automatic_refund BOOLEAN DEFAULT FALSE
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_payment_status public.payment_status;
    v_order_status TEXT;
BEGIN
    IF p_gateway_payment_id IS NULL OR btrim(p_gateway_payment_id) = ''
       OR p_gateway_order_id IS NULL OR btrim(p_gateway_order_id) = ''
       OR p_user_id IS NULL OR p_reason IS NULL OR btrim(p_reason) = '' THEN
        RETURN 'error';
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_gateway_payment_id, 0));
    SELECT transaction.status
    INTO v_payment_status
    FROM public.payment_transactions AS transaction
    WHERE transaction.gateway = 'razorpay'::public.payment_gateway
      AND transaction.gateway_payment_id = p_gateway_payment_id
      AND transaction.gateway_order_id = p_gateway_order_id
    FOR UPDATE;
    IF NOT FOUND OR v_payment_status NOT IN ('captured', 'refund_review', 'refunded') THEN
        RETURN 'error';
    END IF;
    IF v_payment_status = 'refunded' THEN RETURN 'refunded'; END IF;

    SELECT order_log.status
    INTO v_order_status
    FROM public.razorpay_order_logs AS order_log
    WHERE order_log.order_id = p_gateway_order_id
      AND order_log.user_id = p_user_id
    FOR UPDATE;
    IF NOT FOUND THEN RETURN 'error'; END IF;

    IF NOT p_preserve_fulfilled_order AND v_order_status = 'fulfilled' THEN
        RETURN 'fulfilled';
    END IF;
    IF NOT p_preserve_fulfilled_order AND v_order_status = 'refunded' THEN
        RETURN 'refunded';
    END IF;

    IF NOT p_preserve_fulfilled_order THEN
        IF v_order_status NOT IN ('created', 'superseded', 'failed', 'captured', 'refund_review') THEN
            RETURN 'error';
        END IF;
        UPDATE public.razorpay_order_logs
        SET status = 'refund_review'
        WHERE order_id = p_gateway_order_id;
    END IF;

    INSERT INTO public.payment_refund_reviews (
        gateway_payment_id,
        gateway_order_id,
        user_id,
        reason,
        automatic_refund_state
    ) VALUES (
        p_gateway_payment_id,
        p_gateway_order_id,
        p_user_id,
        p_reason,
        CASE WHEN p_automatic_refund THEN 'retryable' ELSE 'manual' END
    )
    ON CONFLICT (gateway_payment_id) DO NOTHING;

    RETURN 'recorded';
END;
$$;
REVOKE ALL ON FUNCTION public.record_captured_payment_refund_review(TEXT, TEXT, UUID, TEXT, BOOLEAN, BOOLEAN)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_captured_payment_refund_review(TEXT, TEXT, UUID, TEXT, BOOLEAN, BOOLEAN)
    TO service_role;

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
BEGIN
    IF public.current_user_role() IS DISTINCT FROM 'admin'::public.user_role THEN
        RAISE EXCEPTION 'Only admins can record payment refund references';
    END IF;
    IF auth.uid() IS NULL
       OR p_gateway_payment_id IS NULL OR btrim(p_gateway_payment_id) = ''
       OR p_refund_id IS NULL OR btrim(p_refund_id) = '' OR length(btrim(p_refund_id)) > 128 THEN
        RAISE EXCEPTION 'Payment and refund IDs are required';
    END IF;

    PERFORM 1
    FROM public.payment_transactions AS transaction
    WHERE transaction.gateway_payment_id = p_gateway_payment_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Payment transaction no longer exists'; END IF;

    UPDATE public.payment_refund_reviews AS review
    SET manual_refund_reference = btrim(p_refund_id),
        manual_refund_recorded_by = auth.uid(),
        manual_refund_recorded_at = clock_timestamp()
    WHERE review.gateway_payment_id = p_gateway_payment_id
      AND review.status = 'pending'
      AND review.automatic_refund_state = 'manual'
    RETURNING review.id INTO v_review_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Manually reviewable refund review not found'; END IF;

    -- Keep the transaction, order, and payment hold unchanged until refund webhooks
    -- reconcile processed provider refunds against the captured amount.
    RETURN v_review_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_payment_refund_review(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_payment_refund_review(TEXT, TEXT) TO authenticated;

-- Do not add new alerts after account deletion has blocked the recipient.
CREATE OR REPLACE FUNCTION public.queue_push(p_recipient UUID, p_title TEXT, p_body TEXT, p_data JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM 1
    FROM public.profiles AS recipient
    WHERE recipient.id = p_recipient
      AND recipient.deleted_at IS NULL
    FOR SHARE;
    IF NOT FOUND THEN RETURN; END IF;

    INSERT INTO public.push_outbox (recipient_id, title, body, data)
    VALUES (p_recipient, p_title, p_body, COALESCE(p_data, '{}'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.queue_push(UUID, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;

-- The profile and token locks make this eligibility check serialize with account blocking,
-- which updates the same profile row before cancelling queued notifications.
CREATE OR REPLACE FUNCTION public.claim_push_alerts_for_dispatch(p_outbox_ids UUID[])
RETURNS TABLE (
    id UUID,
    recipient_id UUID,
    title TEXT,
    body TEXT,
    data JSONB,
    attempts INTEGER,
    expo_push_token TEXT,
    registration_version UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF COALESCE(cardinality(p_outbox_ids), 0) = 0 THEN RETURN; END IF;

    -- Lock recipients first, in the same order as block_patient_push_delivery.
    PERFORM recipient.id
    FROM public.profiles AS recipient
    WHERE recipient.id IN (
        SELECT outbox.recipient_id
        FROM public.push_outbox AS outbox
        WHERE outbox.id = ANY(p_outbox_ids)
          AND outbox.delivery_state = 'pending'
    )
    ORDER BY recipient.id
    FOR SHARE OF recipient;

    -- Token registration/deletion also serializes with these row locks.
    PERFORM token.user_id
    FROM public.patient_push_tokens AS token
    WHERE token.user_id IN (
        SELECT outbox.recipient_id
        FROM public.push_outbox AS outbox
        WHERE outbox.id = ANY(p_outbox_ids)
          AND outbox.delivery_state = 'pending'
    )
    ORDER BY token.user_id
    FOR SHARE OF token;

    RETURN QUERY
    WITH eligible AS MATERIALIZED (
        SELECT outbox.id AS outbox_id,
               outbox.recipient_id,
               outbox.title,
               outbox.body,
               outbox.data,
               outbox.attempts,
               token.expo_push_token,
               token.registration_version
        FROM public.push_outbox AS outbox
        JOIN public.profiles AS recipient ON recipient.id = outbox.recipient_id
        JOIN public.patient_push_tokens AS token ON token.user_id = recipient.id
        WHERE outbox.id = ANY(p_outbox_ids)
          AND outbox.delivery_state = 'pending'
          AND outbox.attempts < 5
          AND recipient.deleted_at IS NULL
        ORDER BY outbox.created_at, outbox.id
        FOR UPDATE OF outbox SKIP LOCKED
    ), claimed AS (
        UPDATE public.push_outbox AS outbox
        SET delivery_state = 'sending',
            delivery_claimed_at = clock_timestamp()
        FROM eligible
        WHERE outbox.id = eligible.outbox_id
          AND outbox.delivery_state = 'pending'
        RETURNING outbox.id, outbox.recipient_id, outbox.title, outbox.body,
                  outbox.data, outbox.attempts
    )
    SELECT claimed.id,
           claimed.recipient_id,
           claimed.title,
           claimed.body,
           claimed.data,
           claimed.attempts,
           eligible.expo_push_token,
           eligible.registration_version
    FROM claimed
    JOIN eligible ON eligible.outbox_id = claimed.id;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_push_alerts_for_dispatch(UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_push_alerts_for_dispatch(UUID[]) TO service_role;

CREATE OR REPLACE FUNCTION public.block_patient_push_delivery(p_patient_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_patient_id UUID;
BEGIN
    -- Stop new claims while checking whether a prior claim is still being submitted.
    SELECT patient.id INTO v_patient_id
    FROM public.profiles AS patient
    WHERE patient.id = p_patient_id
      AND patient.role = 'patient'::public.user_role
    FOR UPDATE;
    IF NOT FOUND THEN RETURN FALSE; END IF;

    -- Do not block the account mid-dispatch. The caller can retry after the worker records its outcome.
    IF EXISTS (
        SELECT 1
        FROM public.push_outbox AS outbox
        WHERE outbox.recipient_id = p_patient_id
          AND outbox.delivery_state = 'sending'
    ) THEN
        RETURN FALSE;
    END IF;

    UPDATE public.profiles AS patient
    SET deleted_at = COALESCE(patient.deleted_at, clock_timestamp())
    WHERE patient.id = v_patient_id;

    DELETE FROM public.patient_push_tokens AS token
    WHERE token.user_id = p_patient_id;

    UPDATE public.push_outbox AS outbox
    SET delivery_state = 'failed',
        delivery_claimed_at = NULL,
        receipt_next_check_at = NULL,
        last_error = 'Alert cancelled because the recipient account was blocked for deletion.'
    WHERE outbox.recipient_id = p_patient_id
      AND outbox.delivery_state = 'pending';

    RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.block_patient_push_delivery(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.block_patient_push_delivery(UUID) TO service_role;
