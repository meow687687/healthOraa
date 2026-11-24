-- Keep reservation expiry atomic with the payment confirmation.
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
      AND payment_expires_at > NOW();
    RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_consultation_payment_capture(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_consultation_payment_capture(UUID, UUID, TEXT) TO service_role;

-- The device token is a capability held by the currently signed-in device. Transfer ownership atomically so
-- an account switch cannot keep sending this device's alerts to the previous account.
CREATE OR REPLACE FUNCTION public.register_patient_push_token(p_expo_push_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_role public.user_role;
    v_deleted_at TIMESTAMPTZ;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Only active patients may register a device token';
    END IF;

    -- Serialize registration with account deletion. If this wins the row lock, deletion removes the
    -- token after it commits; if deletion wins, this sees deleted_at and refuses the registration.
    SELECT profile.role, profile.deleted_at
    INTO v_role, v_deleted_at
    FROM public.profiles AS profile
    WHERE profile.id = v_user_id
    FOR UPDATE;
    IF NOT FOUND OR v_role IS DISTINCT FROM 'patient'::public.user_role OR v_deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'Only active patients may register a device token';
    END IF;

    IF p_expo_push_token IS NULL OR btrim(p_expo_push_token) = '' OR char_length(p_expo_push_token) > 512 THEN
        RAISE EXCEPTION 'A valid device token is required';
    END IF;

    DELETE FROM public.patient_push_tokens
    WHERE expo_push_token = p_expo_push_token AND user_id <> v_user_id;

    INSERT INTO public.patient_push_tokens (user_id, expo_push_token, updated_at)
    VALUES (v_user_id, p_expo_push_token, NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET expo_push_token = EXCLUDED.expo_push_token,
        updated_at = EXCLUDED.updated_at;
END;
$$;
REVOKE ALL ON FUNCTION public.register_patient_push_token(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_patient_push_token(TEXT) TO authenticated;

-- Registration must go through the profile-locking RPC. Keep only the patient's read and sign-out delete paths.
DROP POLICY IF EXISTS "Users manage only their own push token" ON public.patient_push_tokens;
CREATE POLICY "Patients read own push token" ON public.patient_push_tokens
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) AND public.current_user_role() IS NOT NULL);
CREATE POLICY "Patients delete own push token" ON public.patient_push_tokens
    FOR DELETE TO authenticated
    USING (user_id = (SELECT auth.uid()) AND public.current_user_role() IS NOT NULL);
REVOKE INSERT, UPDATE ON public.patient_push_tokens FROM authenticated;
GRANT SELECT, DELETE ON public.patient_push_tokens TO authenticated;

-- Account deletion only receives verified patient-owned locker files, excluding retained diagnostic reports.
CREATE OR REPLACE FUNCTION public.list_patient_owned_record_objects(p_patient_id UUID)
RETURNS TABLE (bucket_id TEXT, name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT object.bucket_id, object.name
    FROM storage.objects AS object
    WHERE object.bucket_id IN ('medical-records', 'patient-reports')
      AND object.owner_id = p_patient_id::text
      AND split_part(object.name, '/', 1) = p_patient_id::text
      AND split_part(object.name, '/', 2) IN ('locker', 'health-locker')
      AND array_length(string_to_array(object.name, '/'), 1) = 3
      AND split_part(object.name, '/', 3) NOT IN ('.', '..')
      AND NOT EXISTS (
          SELECT 1 FROM public.diagnostic_reports report
          WHERE report.patient_id = p_patient_id
            AND position(object.name IN report.file_url) > 0
      )
    ORDER BY object.name;
$$;
REVOKE ALL ON FUNCTION public.list_patient_owned_record_objects(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_patient_owned_record_objects(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.list_patient_owned_meal_objects(p_patient_id UUID)
RETURNS TABLE (bucket_id TEXT, name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT object.bucket_id, object.name
    FROM storage.objects AS object
    WHERE object.bucket_id IN ('diet-charts', 'patient-reports')
      AND object.owner_id = p_patient_id::text
      AND split_part(object.name, '/', 1) = p_patient_id::text
      AND split_part(object.name, '/', 2) = 'meals'
      AND array_length(string_to_array(object.name, '/'), 1) = 3
      AND split_part(object.name, '/', 3) NOT IN ('.', '..')
    ORDER BY object.name;
$$;
REVOKE ALL ON FUNCTION public.list_patient_owned_meal_objects(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_patient_owned_meal_objects(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.has_pending_payment_refund_review(
    p_user_id UUID,
    p_entity_type TEXT,
    p_entity_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.payment_refund_reviews AS review
        JOIN public.razorpay_order_logs AS order_log
          ON order_log.order_id = review.gateway_order_id
        WHERE review.user_id = p_user_id
          AND review.status = 'pending'
          AND order_log.user_id = p_user_id
          AND order_log.entity_type = p_entity_type
          AND order_log.entity_id = p_entity_id
    );
$$;
REVOKE ALL ON FUNCTION public.has_pending_payment_refund_review(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_pending_payment_refund_review(UUID, TEXT, UUID) TO service_role;

-- Patient home screens listen for webhook-created enrolments and refresh the active plan immediately.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'program_enrolments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.program_enrolments;
    END IF;
END;
$$;
