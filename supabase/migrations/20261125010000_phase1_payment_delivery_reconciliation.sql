-- Keep payment eligibility and capture ownership under database time and row locks.
CREATE OR REPLACE FUNCTION public.preserve_refunded_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF OLD.status = 'refunded'
       AND NEW.status IS DISTINCT FROM 'refunded'::public.payment_status
       AND NEW.status IS DISTINCT FROM 'refund_review'::public.payment_status THEN
        NEW.status := 'refunded';
    END IF;
    RETURN NEW;
END;
$$;

ALTER TABLE public.razorpay_order_logs
    ADD COLUMN captured_payment_id TEXT;

WITH first_captures AS (
    SELECT DISTINCT ON (gateway_order_id) gateway_order_id, gateway_payment_id
    FROM public.payment_transactions
    WHERE gateway = 'razorpay' AND status = 'captured' AND gateway_order_id IS NOT NULL
    ORDER BY gateway_order_id, created_at, gateway_payment_id
)
UPDATE public.razorpay_order_logs AS order_log
SET captured_payment_id = first_captures.gateway_payment_id
FROM first_captures
WHERE order_log.order_id = first_captures.gateway_order_id;

CREATE UNIQUE INDEX razorpay_order_logs_captured_payment_idx
    ON public.razorpay_order_logs (captured_payment_id)
    WHERE captured_payment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.can_start_mobile_payment(
    p_user_id UUID,
    p_entity_type TEXT,
    p_entity_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_role public.user_role;
    v_deleted_at TIMESTAMPTZ;
BEGIN
    SELECT profile.role, profile.deleted_at
    INTO v_role, v_deleted_at
    FROM public.profiles AS profile
    WHERE profile.id = p_user_id;
    IF NOT FOUND OR v_role IS DISTINCT FROM 'patient'::public.user_role OR v_deleted_at IS NOT NULL THEN
        RETURN FALSE;
    END IF;

    IF p_entity_type = 'consultation' THEN
        RETURN EXISTS (
            SELECT 1 FROM public.consultations AS consultation
            WHERE consultation.id = p_entity_id
              AND consultation.patient_id = p_user_id
              AND consultation.booking_status = 'pending_payment'
              AND consultation.payment_expires_at > NOW()
        );
    ELSIF p_entity_type = 'shop_order' THEN
        RETURN EXISTS (
            SELECT 1 FROM public.orders AS shop_order
            WHERE shop_order.id = p_entity_id
              AND shop_order.customer_id = p_user_id
              AND shop_order.status = 'pending'
              AND shop_order.stock_released_at IS NULL
              AND shop_order.reservation_expires_at > NOW()
        );
    ELSIF p_entity_type = 'program' THEN
        RETURN EXISTS (
            SELECT 1 FROM public.programs AS program
            WHERE program.id = p_entity_id AND program.is_active
        ) AND NOT EXISTS (
            SELECT 1 FROM public.program_enrolments AS enrolment
            WHERE enrolment.patient_id = p_user_id
              AND enrolment.program_id = p_entity_id
              AND enrolment.status = 'active'
              AND enrolment.expires_at > NOW()
        );
    END IF;
    RETURN FALSE;
END;
$$;
REVOKE ALL ON FUNCTION public.can_start_mobile_payment(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_start_mobile_payment(UUID, TEXT, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.link_consultation_payment_order(
    p_consultation_id UUID,
    p_patient_id UUID,
    p_order_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.consultations
    SET payment_order_id = p_order_id
    WHERE id = p_consultation_id
      AND patient_id = p_patient_id
      AND booking_status = 'pending_payment'
      AND payment_expires_at > NOW();
    RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.link_consultation_payment_order(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_consultation_payment_order(UUID, UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_razorpay_order_capture(p_order_id TEXT, p_payment_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF p_order_id IS NULL OR p_payment_id IS NULL OR btrim(p_order_id) = '' OR btrim(p_payment_id) = '' THEN
        RETURN FALSE;
    END IF;
    UPDATE public.razorpay_order_logs
    SET captured_payment_id = COALESCE(captured_payment_id, p_payment_id),
        status = CASE WHEN status = 'created' THEN 'captured' ELSE status END
    WHERE order_id = p_order_id
      AND status IN ('created', 'captured', 'fulfilled')
      AND (captured_payment_id IS NULL OR captured_payment_id = p_payment_id);
    RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_razorpay_order_capture(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_razorpay_order_capture(TEXT, TEXT) TO service_role;

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
BEGIN
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

CREATE OR REPLACE FUNCTION public.confirm_shop_order_payment_capture(
    p_order_id UUID,
    p_patient_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
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
REVOKE ALL ON FUNCTION public.confirm_shop_order_payment_capture(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_shop_order_payment_capture(UUID, UUID) TO service_role;

-- Distinguish retryable automatic refunds from refunds owned by manual review.
ALTER TABLE public.payment_refund_reviews
    ADD COLUMN automatic_refund_state TEXT NOT NULL DEFAULT 'manual',
    ADD COLUMN last_reconciled_processed_paise BIGINT NOT NULL DEFAULT 0
        CHECK (last_reconciled_processed_paise >= 0),
    ADD COLUMN last_reconciled_pending_count BIGINT NOT NULL DEFAULT 0
        CHECK (last_reconciled_pending_count >= 0),
    ADD COLUMN last_reconciled_failed_count BIGINT NOT NULL DEFAULT 0
        CHECK (last_reconciled_failed_count >= 0),
    ADD CONSTRAINT payment_refund_reviews_automatic_state_check
        CHECK (automatic_refund_state IN ('manual', 'retryable', 'pending'));
UPDATE public.payment_refund_reviews
SET automatic_refund_state = 'pending'
WHERE status = 'pending' AND refund_id IS NOT NULL;

-- Keep provider refund events even when Razorpay delivers them before the capture audit row.
CREATE TABLE public.razorpay_refund_events (
    refund_id TEXT PRIMARY KEY,
    gateway_payment_id TEXT NOT NULL,
    gateway_order_id TEXT,
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    status TEXT NOT NULL CHECK (status IN ('created', 'processed', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX razorpay_refund_events_payment_idx
    ON public.razorpay_refund_events (gateway_payment_id, status);
ALTER TABLE public.razorpay_refund_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.razorpay_refund_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.razorpay_refund_events TO service_role;

CREATE OR REPLACE FUNCTION public.record_razorpay_refund_event(
    p_refund_id TEXT,
    p_gateway_payment_id TEXT,
    p_gateway_order_id TEXT,
    p_amount_paise BIGINT,
    p_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_refund_id TEXT;
BEGIN
    IF p_refund_id IS NULL OR btrim(p_refund_id) = ''
       OR p_gateway_payment_id IS NULL OR btrim(p_gateway_payment_id) = ''
       OR p_amount_paise IS NULL OR p_amount_paise <= 0
       OR p_status NOT IN ('created', 'processed', 'failed') THEN
        RETURN FALSE;
    END IF;

    INSERT INTO public.razorpay_refund_events (
        refund_id, gateway_payment_id, gateway_order_id, amount_paise, status
    ) VALUES (
        p_refund_id, p_gateway_payment_id, p_gateway_order_id, p_amount_paise, p_status
    )
    ON CONFLICT (refund_id) DO UPDATE
    SET gateway_order_id = COALESCE(public.razorpay_refund_events.gateway_order_id, EXCLUDED.gateway_order_id),
        status = CASE
            WHEN public.razorpay_refund_events.status = 'processed' OR EXCLUDED.status = 'processed' THEN 'processed'
            WHEN EXCLUDED.status = 'failed' THEN 'failed'
            ELSE public.razorpay_refund_events.status
        END,
        updated_at = NOW()
    WHERE public.razorpay_refund_events.gateway_payment_id = EXCLUDED.gateway_payment_id
      AND public.razorpay_refund_events.amount_paise = EXCLUDED.amount_paise
      AND (public.razorpay_refund_events.gateway_order_id IS NULL
           OR EXCLUDED.gateway_order_id IS NULL
           OR public.razorpay_refund_events.gateway_order_id = EXCLUDED.gateway_order_id)
    RETURNING refund_id INTO v_refund_id;
    RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.record_razorpay_refund_event(TEXT, TEXT, TEXT, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_razorpay_refund_event(TEXT, TEXT, TEXT, BIGINT, TEXT) TO service_role;

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
        UPDATE public.razorpay_order_logs
        SET status = 'refunded'
        WHERE order_id = v_order_id
          AND captured_payment_id = p_gateway_payment_id
          AND status IN ('captured', 'refund_review');
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

-- A newly purchased term must not be attached to an already-active enrolment without payment for that term.
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

    -- Lock the payment before the order log so this path serializes with refund reconciliation.
    PERFORM 1
    FROM public.payment_transactions
    WHERE gateway = 'razorpay'
      AND gateway_payment_id = v_captured_payment_id
      AND gateway_order_id = p_order_id
      AND status = 'captured'
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
        IF v_order.captured_payment_id IS NULL THEN
            RAISE EXCEPTION 'Captured payment ID is missing for active-enrolment review';
        END IF;
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

-- Token registration versions prevent delayed Expo failures from deleting a replacement device token.
ALTER TABLE public.patient_push_tokens
    ADD COLUMN registration_version UUID NOT NULL DEFAULT gen_random_uuid();
CREATE OR REPLACE FUNCTION public.rotate_patient_push_token_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.registration_version := gen_random_uuid();
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.rotate_patient_push_token_registration() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER rotate_patient_push_token_registration
    BEFORE INSERT OR UPDATE ON public.patient_push_tokens
    FOR EACH ROW EXECUTE FUNCTION public.rotate_patient_push_token_registration();

ALTER TABLE public.push_outbox
    ADD COLUMN receipt_next_check_at TIMESTAMPTZ,
    ADD COLUMN expo_token_registration_version UUID,
    ADD COLUMN delivery_state TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN delivery_claimed_at TIMESTAMPTZ;
ALTER TABLE public.push_outbox
    ADD CONSTRAINT push_outbox_delivery_state_check
    CHECK (delivery_state IN ('pending', 'sending', 'sent', 'failed', 'unknown'));
UPDATE public.push_outbox
SET delivery_state = CASE WHEN sent_at IS NULL THEN 'pending' ELSE 'sent' END,
    receipt_next_check_at = CASE
        WHEN expo_ticket_id IS NOT NULL AND receipt_checked_at IS NULL THEN sent_at + INTERVAL '15 minutes'
        ELSE NULL
    END;
CREATE INDEX push_outbox_delivery_pending_idx
    ON public.push_outbox (created_at)
    WHERE delivery_state = 'pending';
CREATE INDEX push_outbox_receipt_due_idx
    ON public.push_outbox (receipt_next_check_at, sent_at)
    WHERE expo_ticket_id IS NOT NULL AND receipt_checked_at IS NULL;

-- Keep admin resolution in the same payment → review → order lock order as webhook reconciliation.
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

    SELECT transaction.gateway_payment_id
    INTO v_gateway_payment_id
    FROM public.payment_transactions AS transaction
    WHERE transaction.gateway_payment_id = p_gateway_payment_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Payment transaction no longer exists'; END IF;

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
        WHERE order_id = v_gateway_order_id
          AND captured_payment_id = v_gateway_payment_id
          AND status = 'refund_review';
    RETURN v_review_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_payment_refund_review(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_payment_refund_review(TEXT, TEXT) TO authenticated;
