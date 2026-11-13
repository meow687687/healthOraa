-- Admin overview. One read returns every figure the dashboard shows, so the browser does not download
-- whole tables to count them. Admin only. Reads only; no table changes.
CREATE OR REPLACE FUNCTION public.admin_dashboard_summary(p_days INT DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_days INT := LEAST(GREATEST(COALESCE(p_days, 30), 7), 90);
    v_now TIMESTAMPTZ := NOW();
    v_from TIMESTAMPTZ := NOW() - make_interval(days => LEAST(GREATEST(COALESCE(p_days, 30), 7), 90));
    v_week_ago TIMESTAMPTZ := NOW() - INTERVAL '7 days';
    v_two_weeks_ago TIMESTAMPTZ := NOW() - INTERVAL '14 days';
    v_result JSONB;
BEGIN
    IF public.current_user_role() IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'Only admins can read the dashboard';
    END IF;

    SELECT jsonb_build_object(
        'generated_at', v_now,
        'window_days', v_days,

        'attention', jsonb_build_object(
            'pending_verifications', (SELECT count(*) FROM public.practitioner_details WHERE verification_status = 'pending'),
            'failed_payments_24h', (SELECT count(*) FROM public.payment_transactions
                                    WHERE status = 'failed' AND created_at > v_now - INTERVAL '24 hours'),
            'paid_unshipped', (SELECT count(*) FROM public.orders WHERE status = 'paid'),
            'low_stock', (SELECT count(*) FROM public.products WHERE is_active AND stock_count <= 5),
            'open_compliance', (SELECT count(*) FROM public.compliance_requests WHERE status IN ('pending', 'processing'))
        ),

        'signals', jsonb_build_object(
            'stale_payment_orders', (SELECT count(*) FROM public.razorpay_order_logs
                                     WHERE status = 'created' AND created_at < v_now - INTERVAL '30 minutes'),
            'bookings_awaiting_payment', (SELECT count(*) FROM public.consultations
                                          WHERE booking_status = 'pending_payment' AND created_at < v_now - INTERVAL '30 minutes'),
            'active_enrolments', (SELECT count(*) FROM public.program_enrolments
                                  WHERE status = 'active' AND expires_at > v_now)
        ),

        'kpis', jsonb_build_object(
            'revenue_inr', jsonb_build_object(
                'current', (SELECT COALESCE(sum(amount_inr), 0) FROM public.payment_transactions
                            WHERE status = 'captured' AND created_at >= v_week_ago),
                'previous', (SELECT COALESCE(sum(amount_inr), 0) FROM public.payment_transactions
                             WHERE status = 'captured' AND created_at >= v_two_weeks_ago AND created_at < v_week_ago)
            ),
            'orders', jsonb_build_object(
                'current', (SELECT count(*) FROM public.orders WHERE created_at >= v_week_ago),
                'previous', (SELECT count(*) FROM public.orders WHERE created_at >= v_two_weeks_ago AND created_at < v_week_ago)
            ),
            'bookings', jsonb_build_object(
                'current', (SELECT count(*) FROM public.consultations
                            WHERE booking_status = 'confirmed' AND created_at >= v_week_ago),
                'previous', (SELECT count(*) FROM public.consultations
                             WHERE booking_status = 'confirmed' AND created_at >= v_two_weeks_ago AND created_at < v_week_ago)
            ),
            'enrolments', jsonb_build_object(
                'current', (SELECT count(*) FROM public.program_enrolments WHERE started_at >= v_week_ago),
                'previous', (SELECT count(*) FROM public.program_enrolments
                             WHERE started_at >= v_two_weeks_ago AND started_at < v_week_ago)
            )
        ),

        'daily', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'day', d.day,
                'revenue_inr', COALESCE(r.amount, 0),
                'orders', COALESCE(o.n, 0),
                'bookings', COALESCE(b.n, 0),
                'enrolments', COALESCE(e.n, 0)
            ) ORDER BY d.day), '[]'::jsonb)
            FROM (
                SELECT gs.day::date AS day
                FROM generate_series(
                    (v_now AT TIME ZONE 'Asia/Kolkata')::date - (v_days - 1),
                    (v_now AT TIME ZONE 'Asia/Kolkata')::date,
                    INTERVAL '1 day'
                ) AS gs(day)
            ) AS d
            LEFT JOIN (
                SELECT (created_at AT TIME ZONE 'Asia/Kolkata')::date AS day, sum(amount_inr) AS amount
                FROM public.payment_transactions
                WHERE status = 'captured' AND created_at >= v_from
                GROUP BY 1
            ) AS r ON r.day = d.day
            LEFT JOIN (
                SELECT (created_at AT TIME ZONE 'Asia/Kolkata')::date AS day, count(*) AS n
                FROM public.orders WHERE created_at >= v_from GROUP BY 1
            ) AS o ON o.day = d.day
            LEFT JOIN (
                SELECT (created_at AT TIME ZONE 'Asia/Kolkata')::date AS day, count(*) AS n
                FROM public.consultations WHERE booking_status = 'confirmed' AND created_at >= v_from GROUP BY 1
            ) AS b ON b.day = d.day
            LEFT JOIN (
                SELECT (started_at AT TIME ZONE 'Asia/Kolkata')::date AS day, count(*) AS n
                FROM public.program_enrolments WHERE started_at >= v_from GROUP BY 1
            ) AS e ON e.day = d.day
        ),

        'revenue_previous_daily', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object('day', d.day, 'revenue_inr', COALESCE(r.amount, 0))
                                      ORDER BY d.day), '[]'::jsonb)
            FROM (
                SELECT gs.day::date AS day
                FROM generate_series(
                    (v_now AT TIME ZONE 'Asia/Kolkata')::date - (2 * v_days - 1),
                    (v_now AT TIME ZONE 'Asia/Kolkata')::date - v_days,
                    INTERVAL '1 day'
                ) AS gs(day)
            ) AS d
            LEFT JOIN (
                SELECT (created_at AT TIME ZONE 'Asia/Kolkata')::date AS day, sum(amount_inr) AS amount
                FROM public.payment_transactions
                WHERE status = 'captured'
                  AND created_at >= v_from - make_interval(days => v_days)
                  AND created_at < v_from
                GROUP BY 1
            ) AS r ON r.day = d.day
        ),

        'orders_by_status', (
            SELECT COALESCE(jsonb_object_agg(s.status, s.n), '{}'::jsonb)
            FROM (SELECT status::text AS status, count(*) AS n FROM public.orders
                  WHERE created_at >= v_from GROUP BY status) AS s
        ),

        'funnel', jsonb_build_object(
            'slots_published', (SELECT count(*) FROM public.consultation_slots WHERE created_at >= v_from),
            'booked', (SELECT count(*) FROM public.consultations
                       WHERE created_at >= v_from AND booking_status <> 'cancelled'),
            'paid', (SELECT count(*) FROM public.consultations
                     WHERE created_at >= v_from AND booking_status = 'confirmed'),
            'completed', (SELECT count(*) FROM public.consultations
                          WHERE created_at >= v_from AND status = 'completed')
        ),

        'heatmap', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object('weekday', h.weekday, 'hour', h.hour, 'count', h.n)), '[]'::jsonb)
            FROM (
                SELECT extract(isodow FROM (c.slot_start AT TIME ZONE 'Asia/Kolkata'))::int AS weekday,
                       extract(hour FROM (c.slot_start AT TIME ZONE 'Asia/Kolkata'))::int AS hour,
                       count(*) AS n
                FROM public.consultations AS c
                WHERE c.booking_status = 'confirmed' AND c.created_at >= v_from
                GROUP BY 1, 2
            ) AS h
        ),

        'top_products', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', t.product_id, 'title', t.title, 'units', t.units, 'revenue_inr', t.revenue
            ) ORDER BY t.units DESC), '[]'::jsonb)
            FROM (
                SELECT oi.product_id, p.title, sum(oi.quantity)::bigint AS units,
                       sum(oi.quantity * oi.unit_price_inr) AS revenue
                FROM public.order_items AS oi
                JOIN public.orders AS o ON o.id = oi.order_id
                JOIN public.products AS p ON p.id = oi.product_id
                WHERE o.status <> 'cancelled' AND o.created_at >= v_from
                GROUP BY oi.product_id, p.title
                ORDER BY units DESC
                LIMIT 5
            ) AS t
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_dashboard_summary(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_summary(INT) TO authenticated;
