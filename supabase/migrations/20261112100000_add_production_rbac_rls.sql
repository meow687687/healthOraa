-- Replace local-development policies with role- and ownership-scoped access.
-- The user_role migration maps legacy customer/doctor/nutritionist rows to the
-- patient/practitioner roles used by production authorization.

ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT;
CREATE TYPE public.user_role_v2 AS ENUM ('patient', 'practitioner', 'admin');
ALTER TABLE public.profiles
    ALTER COLUMN role TYPE public.user_role_v2
    USING (CASE role::text
        WHEN 'customer' THEN 'patient'
        WHEN 'doctor' THEN 'practitioner'
        WHEN 'nutritionist' THEN 'practitioner'
        ELSE role::text
    END)::public.user_role_v2;
DROP TYPE public.user_role;
ALTER TYPE public.user_role_v2 RENAME TO user_role;
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'patient';

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT p.role FROM public.profiles AS p WHERE p.id = (SELECT auth.uid())
$$;
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- Remove every earlier policy on public tables, including overlapping permissive
-- policies (Postgres ORs permissive policies together).
DO $$
DECLARE
    policy_row RECORD;
BEGIN
    FOR policy_row IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY %I ON %I.%I', policy_row.policyname,
            policy_row.schemaname, policy_row.tablename);
    END LOOP;
END;
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Admins are the only role with unrestricted table access.
DO $$
DECLARE
    table_row RECORD;
BEGIN
    FOR table_row IN
        SELECT c.relname
        FROM pg_class AS c
        JOIN pg_namespace AS n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
          AND c.relrowsecurity
    LOOP
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.current_user_role() = ''admin'') WITH CHECK (public.current_user_role() = ''admin'')',
            'Admin full access', table_row.relname);
    END LOOP;
END;
$$;

CREATE POLICY "Profiles read own or assigned patient" ON public.profiles
    FOR SELECT TO authenticated
    USING (id = (SELECT auth.uid()) OR (
        public.current_user_role() = 'practitioner' AND EXISTS (
            SELECT 1 FROM public.consultations c
            WHERE c.patient_id = profiles.id AND c.doctor_id = (SELECT auth.uid())
        )
    ));
CREATE POLICY "Users update own profile" ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = (SELECT auth.uid()))
    WITH CHECK (id = (SELECT auth.uid()) AND role = public.current_user_role());

CREATE POLICY "Patients read active practitioners" ON public.practitioner_details
    FOR SELECT TO authenticated
    USING (is_active AND public.current_user_role() = 'patient');
CREATE POLICY "Practitioners read own details" ON public.practitioner_details
    FOR SELECT TO authenticated
    USING (id = (SELECT auth.uid()) AND public.current_user_role() = 'practitioner');
CREATE POLICY "Practitioners update own details" ON public.practitioner_details
    FOR UPDATE TO authenticated
    USING (id = (SELECT auth.uid()) AND public.current_user_role() = 'practitioner')
    WITH CHECK (id = (SELECT auth.uid()) AND public.current_user_role() = 'practitioner');

CREATE POLICY "Patients read active programs" ON public.programs
    FOR SELECT TO authenticated
    USING (is_active AND public.current_user_role() = 'patient');
CREATE POLICY "Patients read active banners" ON public.app_banners
    FOR SELECT TO authenticated
    USING (is_active AND public.current_user_role() = 'patient');
CREATE POLICY "Patients read active products" ON public.products
    FOR SELECT TO authenticated
    USING (is_active AND public.current_user_role() = 'patient');

CREATE POLICY "Participants read consultations" ON public.consultations
    FOR SELECT TO authenticated
    USING (
        (patient_id = (SELECT auth.uid()) AND public.current_user_role() = 'patient')
        OR (doctor_id = (SELECT auth.uid()) AND public.current_user_role() = 'practitioner')
    );
CREATE POLICY "Practitioners update own consultations" ON public.consultations
    FOR UPDATE TO authenticated
    USING (doctor_id = (SELECT auth.uid()) AND public.current_user_role() = 'practitioner')
    WITH CHECK (doctor_id = (SELECT auth.uid()) AND public.current_user_role() = 'practitioner');

CREATE POLICY "Practitioners manage own availability" ON public.practitioner_availability_rules
    FOR ALL TO authenticated
    USING (practitioner_id = (SELECT auth.uid()) AND public.current_user_role() = 'practitioner')
    WITH CHECK (practitioner_id = (SELECT auth.uid()) AND public.current_user_role() = 'practitioner');
CREATE POLICY "Patients read future open slots" ON public.consultation_slots
    FOR SELECT TO authenticated
    USING (NOT is_booked AND start_time > now() AND public.current_user_role() = 'patient');
CREATE POLICY "Practitioners read own slots" ON public.consultation_slots
    FOR SELECT TO authenticated
    USING (practitioner_id = (SELECT auth.uid()) AND public.current_user_role() = 'practitioner');
CREATE POLICY "Practitioners create own slots" ON public.consultation_slots
    FOR INSERT TO authenticated
    WITH CHECK (practitioner_id = (SELECT auth.uid()) AND public.current_user_role() = 'practitioner');
CREATE POLICY "Practitioners update own slots" ON public.consultation_slots
    FOR UPDATE TO authenticated
    USING (practitioner_id = (SELECT auth.uid()) AND public.current_user_role() = 'practitioner')
    WITH CHECK (practitioner_id = (SELECT auth.uid()) AND public.current_user_role() = 'practitioner');
CREATE POLICY "Practitioners delete own open slots" ON public.consultation_slots
    FOR DELETE TO authenticated
    USING (practitioner_id = (SELECT auth.uid()) AND public.current_user_role() = 'practitioner' AND NOT is_booked);

CREATE POLICY "Patients read own prescriptions" ON public.prescriptions
    FOR SELECT TO authenticated
    USING (patient_id = (SELECT auth.uid()) AND public.current_user_role() = 'patient');
CREATE POLICY "Practitioners read own consultation prescriptions" ON public.prescriptions
    FOR SELECT TO authenticated
    USING (doctor_id = (SELECT auth.uid()) AND public.current_user_role() = 'practitioner');
CREATE POLICY "Practitioners create prescriptions for own consultations" ON public.prescriptions
    FOR INSERT TO authenticated
    WITH CHECK (doctor_id = (SELECT auth.uid()) AND public.current_user_role() = 'practitioner'
        AND EXISTS (SELECT 1 FROM public.consultations c
            WHERE c.id = prescriptions.consultation_id AND c.doctor_id = (SELECT auth.uid())
              AND c.patient_id = prescriptions.patient_id));
CREATE POLICY "Patients read medicines on own prescriptions" ON public.prescription_medicines
    FOR SELECT TO authenticated
    USING (public.current_user_role() = 'patient' AND EXISTS (
        SELECT 1 FROM public.prescriptions p
        WHERE p.id = prescription_medicines.prescription_id AND p.patient_id = (SELECT auth.uid())
    ));
CREATE POLICY "Practitioners read own prescription medicines" ON public.prescription_medicines
    FOR SELECT TO authenticated
    USING (public.current_user_role() = 'practitioner' AND EXISTS (
        SELECT 1 FROM public.prescriptions p
        WHERE p.id = prescription_medicines.prescription_id AND p.doctor_id = (SELECT auth.uid())
    ));
CREATE POLICY "Practitioners add own prescription medicines" ON public.prescription_medicines
    FOR INSERT TO authenticated
    WITH CHECK (public.current_user_role() = 'practitioner' AND EXISTS (
        SELECT 1 FROM public.prescriptions p
        WHERE p.id = prescription_medicines.prescription_id AND p.doctor_id = (SELECT auth.uid())
    ));

CREATE POLICY "Patients read own intake forms" ON public.patient_intake_forms
    FOR SELECT TO authenticated
    USING (patient_id = (SELECT auth.uid()) AND public.current_user_role() = 'patient');
CREATE POLICY "Patients create own intake forms" ON public.patient_intake_forms
    FOR INSERT TO authenticated
    WITH CHECK (patient_id = (SELECT auth.uid()) AND public.current_user_role() = 'patient');
CREATE POLICY "Patients update own intake forms" ON public.patient_intake_forms
    FOR UPDATE TO authenticated
    USING (patient_id = (SELECT auth.uid()) AND public.current_user_role() = 'patient')
    WITH CHECK (patient_id = (SELECT auth.uid()) AND public.current_user_role() = 'patient');
CREATE POLICY "Practitioners read intake for confirmed consultations" ON public.patient_intake_forms
    FOR SELECT TO authenticated
    USING (public.current_user_role() = 'practitioner' AND EXISTS (
        SELECT 1 FROM public.consultations c
        WHERE c.id = patient_intake_forms.consultation_id
          AND c.patient_id = patient_intake_forms.patient_id
          AND c.doctor_id = (SELECT auth.uid()) AND c.booking_status = 'confirmed'
    ));
CREATE POLICY "Patients read own diagnostic reports" ON public.diagnostic_reports
    FOR SELECT TO authenticated
    USING (patient_id = (SELECT auth.uid()) AND public.current_user_role() = 'patient');
CREATE POLICY "Patients create own diagnostic reports" ON public.diagnostic_reports
    FOR INSERT TO authenticated
    WITH CHECK (patient_id = (SELECT auth.uid()) AND public.current_user_role() = 'patient');
CREATE POLICY "Patients update own diagnostic reports" ON public.diagnostic_reports
    FOR UPDATE TO authenticated
    USING (patient_id = (SELECT auth.uid()) AND public.current_user_role() = 'patient')
    WITH CHECK (patient_id = (SELECT auth.uid()) AND public.current_user_role() = 'patient');
CREATE POLICY "Practitioners read reports for confirmed consultations" ON public.diagnostic_reports
    FOR SELECT TO authenticated
    USING (public.current_user_role() = 'practitioner' AND EXISTS (
        SELECT 1 FROM public.consultations c
        WHERE c.id = diagnostic_reports.consultation_id
          AND c.patient_id = diagnostic_reports.patient_id
          AND c.doctor_id = (SELECT auth.uid()) AND c.booking_status = 'confirmed'
    ));

CREATE POLICY "Patients read own enrolments" ON public.program_enrolments
    FOR SELECT TO authenticated
    USING (patient_id = (SELECT auth.uid()) AND public.current_user_role() = 'patient');
CREATE POLICY "Dietitians read assigned enrolments" ON public.program_enrolments
    FOR SELECT TO authenticated
    USING (dietitian_id = (SELECT auth.uid()) AND public.current_user_role() = 'practitioner');
CREATE POLICY "Patients read own progress" ON public.program_progress_logs
    FOR SELECT TO authenticated
    USING (public.current_user_role() = 'patient' AND EXISTS (
        SELECT 1 FROM public.program_enrolments e
        WHERE e.id = program_progress_logs.enrolment_id AND e.patient_id = (SELECT auth.uid())
    ));
CREATE POLICY "Patients write own progress" ON public.program_progress_logs
    FOR INSERT TO authenticated
    WITH CHECK (public.current_user_role() = 'patient' AND EXISTS (
        SELECT 1 FROM public.program_enrolments e
        WHERE e.id = program_progress_logs.enrolment_id AND e.patient_id = (SELECT auth.uid())
          AND e.status = 'active' AND e.expires_at > now()
    ));
CREATE POLICY "Dietitians read assigned progress" ON public.program_progress_logs
    FOR SELECT TO authenticated
    USING (public.current_user_role() = 'practitioner' AND EXISTS (
        SELECT 1 FROM public.program_enrolments e
        WHERE e.id = program_progress_logs.enrolment_id AND e.dietitian_id = (SELECT auth.uid())
    ));
CREATE POLICY "Dietitians update assigned progress" ON public.program_progress_logs
    FOR UPDATE TO authenticated
    USING (public.current_user_role() = 'practitioner' AND EXISTS (
        SELECT 1 FROM public.program_enrolments e
        WHERE e.id = program_progress_logs.enrolment_id AND e.dietitian_id = (SELECT auth.uid())
    ))
    WITH CHECK (public.current_user_role() = 'practitioner' AND EXISTS (
        SELECT 1 FROM public.program_enrolments e
        WHERE e.id = program_progress_logs.enrolment_id AND e.dietitian_id = (SELECT auth.uid())
    ));

CREATE POLICY "Participants read consultation messages" ON public.consultation_messages
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.consultations c
        WHERE c.id = consultation_messages.consultation_id
          AND ((c.patient_id = (SELECT auth.uid()) AND public.current_user_role() = 'patient')
            OR (c.doctor_id = (SELECT auth.uid()) AND public.current_user_role() = 'practitioner'))));
CREATE POLICY "Participants send in-window consultation messages" ON public.consultation_messages
    FOR INSERT TO authenticated
    WITH CHECK (sender_id = (SELECT auth.uid()) AND EXISTS (
        SELECT 1 FROM public.consultations c
        WHERE c.id = consultation_messages.consultation_id
          AND ((c.patient_id = (SELECT auth.uid()) AND public.current_user_role() = 'patient')
            OR (c.doctor_id = (SELECT auth.uid()) AND public.current_user_role() = 'practitioner'))
          AND c.followup_expires_at IS NOT NULL AND now() <= c.followup_expires_at
    ));
CREATE POLICY "Participants read program messages" ON public.program_messages
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.program_enrolments e
        WHERE e.id = program_messages.enrolment_id
          AND ((e.patient_id = (SELECT auth.uid()) AND public.current_user_role() = 'patient')
            OR (e.dietitian_id = (SELECT auth.uid()) AND public.current_user_role() = 'practitioner'))));
CREATE POLICY "Participants send active program messages" ON public.program_messages
    FOR INSERT TO authenticated
    WITH CHECK (sender_id = (SELECT auth.uid()) AND EXISTS (
        SELECT 1 FROM public.program_enrolments e
        WHERE e.id = program_messages.enrolment_id
          AND ((e.patient_id = (SELECT auth.uid()) AND public.current_user_role() = 'patient')
            OR (e.dietitian_id = (SELECT auth.uid()) AND public.current_user_role() = 'practitioner'))
          AND e.status = 'active' AND now() <= e.expires_at
    ));

CREATE POLICY "Patients manage own cart" ON public.cart_items
    FOR ALL TO authenticated
    USING (patient_id = (SELECT auth.uid()) AND public.current_user_role() = 'patient')
    WITH CHECK (patient_id = (SELECT auth.uid()) AND public.current_user_role() = 'patient');
CREATE POLICY "Patients read own orders" ON public.orders
    FOR SELECT TO authenticated
    USING (customer_id = (SELECT auth.uid()) AND public.current_user_role() = 'patient');
CREATE POLICY "Patients read own order items" ON public.order_items
    FOR SELECT TO authenticated
    USING (public.current_user_role() = 'patient' AND EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_items.order_id AND o.customer_id = (SELECT auth.uid())
    ));
CREATE POLICY "Patients read own payment transactions" ON public.payment_transactions
    FOR SELECT TO authenticated
    USING (public.current_user_role() = 'patient' AND (
        EXISTS (SELECT 1 FROM public.orders o
            WHERE o.id = payment_transactions.order_id AND o.customer_id = (SELECT auth.uid()))
        OR EXISTS (SELECT 1 FROM public.consultations c
            WHERE c.id = payment_transactions.consultation_id AND c.patient_id = (SELECT auth.uid()))
    ));
CREATE POLICY "Users read own Razorpay order logs" ON public.razorpay_order_logs
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) AND public.current_user_role() IN ('patient', 'practitioner'));

CREATE POLICY "Users read own compliance requests" ON public.compliance_requests
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) AND public.current_user_role() IN ('patient', 'practitioner'));
CREATE POLICY "Users create own compliance requests" ON public.compliance_requests
    FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()) AND public.current_user_role() IN ('patient', 'practitioner'));

CREATE POLICY "Patients read own health locker documents" ON public.patient_documents
    FOR SELECT TO authenticated
    USING (patient_id = (SELECT auth.uid()) AND public.current_user_role() = 'patient');
CREATE POLICY "Patients add own health locker documents" ON public.patient_documents
    FOR INSERT TO authenticated
    WITH CHECK (patient_id = (SELECT auth.uid()) AND public.current_user_role() = 'patient');
CREATE POLICY "Practitioners read consulted patient documents" ON public.patient_documents
    FOR SELECT TO authenticated
    USING (public.current_user_role() = 'practitioner' AND EXISTS (
        SELECT 1 FROM public.consultations c
        WHERE c.patient_id = patient_documents.patient_id AND c.doctor_id = (SELECT auth.uid())
          AND c.booking_status = 'confirmed'
    ));
CREATE POLICY "Patients read own biomarkers" ON public.patient_biomarkers
    FOR SELECT TO authenticated
    USING (patient_id = (SELECT auth.uid()) AND public.current_user_role() = 'patient');
CREATE POLICY "Patients add own biomarkers" ON public.patient_biomarkers
    FOR INSERT TO authenticated
    WITH CHECK (patient_id = (SELECT auth.uid()) AND public.current_user_role() = 'patient');
CREATE POLICY "Practitioners read consulted patient biomarkers" ON public.patient_biomarkers
    FOR SELECT TO authenticated
    USING (public.current_user_role() = 'practitioner' AND EXISTS (
        SELECT 1 FROM public.consultations c
        WHERE c.patient_id = patient_biomarkers.patient_id AND c.doctor_id = (SELECT auth.uid())
          AND c.booking_status = 'confirmed'
    ));

-- Compliance erasure is an administrative operation, not a client-callable
-- operation merely because its implementation uses SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.resolve_erasure_request(p_request_id UUID)
RETURNS public.compliance_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_request public.compliance_requests;
BEGIN
    IF public.current_user_role() IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'Only administrators may resolve erasure requests';
    END IF;
    SELECT * INTO v_request FROM public.compliance_requests WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Compliance request % not found', p_request_id;
    END IF;
    IF v_request.request_type <> 'erasure_request' THEN
        RAISE EXCEPTION 'Request % is not an erasure request', p_request_id;
    END IF;
    UPDATE public.profiles
    SET full_name = 'Anonymised User', phone = NULL, avatar_url = NULL, updated_at = NOW()
    WHERE id = v_request.user_id;
    UPDATE public.compliance_requests
    SET status = 'completed',
        notes = 'Personal data anonymised: name, phone and avatar cleared. Order, payment and consultation records retained for statutory tax and medical record requirements.',
        resolved_at = NOW()
    WHERE id = p_request_id RETURNING * INTO v_request;
    RETURN v_request;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_erasure_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_erasure_request(UUID) TO authenticated;

-- Keep the private reports bucket private; replace broad development storage
-- policies with participant/path-scoped policies.
DROP POLICY IF EXISTS "Development read patient reports" ON storage.objects;
DROP POLICY IF EXISTS "Development upload patient reports" ON storage.objects;
DROP POLICY IF EXISTS "Development downloads from patient reports" ON storage.objects;
DROP POLICY IF EXISTS "Development uploads to patient reports" ON storage.objects;
DROP POLICY IF EXISTS "Consultation participants can read patient reports" ON storage.objects;
DROP POLICY IF EXISTS "Development update patient reports" ON storage.objects;
DROP POLICY IF EXISTS "Development delete patient reports" ON storage.objects;
DROP POLICY IF EXISTS "Patients read own reports" ON storage.objects;
DROP POLICY IF EXISTS "Patients upload own reports" ON storage.objects;
DROP POLICY IF EXISTS "Practitioners read consultation reports" ON storage.objects;
CREATE POLICY "Patients read own reports" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'patient-reports' AND public.current_user_role() = 'patient'
        AND (split_part(name, '/', 1) = (SELECT auth.uid())::text OR EXISTS (
            SELECT 1 FROM public.consultations c
            WHERE c.id::text = split_part(name, '/', 1) AND c.patient_id = (SELECT auth.uid())
              AND c.booking_status = 'confirmed'
        )));
CREATE POLICY "Patients upload own reports" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'patient-reports' AND public.current_user_role() = 'patient'
        AND split_part(name, '/', 1) = (SELECT auth.uid())::text);
CREATE POLICY "Practitioners read consultation reports" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'patient-reports' AND public.current_user_role() = 'practitioner'
        AND EXISTS (SELECT 1 FROM public.consultations c
            WHERE c.id::text = split_part(name, '/', 1)
              AND c.doctor_id = (SELECT auth.uid()) AND c.booking_status = 'confirmed'));
CREATE POLICY "Practitioners upload consultation reports" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'patient-reports' AND public.current_user_role() = 'practitioner'
        AND EXISTS (SELECT 1 FROM public.consultations c
            WHERE c.id::text = split_part(name, '/', 1)
              AND c.doctor_id = (SELECT auth.uid()) AND c.booking_status = 'confirmed'));

-- SECURITY DEFINER RPCs bypass table RLS, so enforce their actor roles at the
-- write boundary as well. Trusted service-role seed/maintenance writes have no uid.
CREATE OR REPLACE FUNCTION public.enforce_rbac_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_role public.user_role;
BEGIN
    IF (SELECT auth.uid()) IS NULL THEN
        RETURN NEW;
    END IF;
    v_role := public.current_user_role();
    IF v_role = 'admin' THEN
        RETURN NEW;
    END IF;

    IF TG_TABLE_NAME = 'practitioner_details' THEN
        IF v_role <> 'practitioner' OR NEW.id <> (SELECT auth.uid()) THEN
            RAISE EXCEPTION 'Only practitioners may update their own details';
        END IF;
    ELSIF TG_TABLE_NAME = 'consultations' THEN
        IF TG_OP = 'UPDATE' THEN
            IF v_role <> 'practitioner' OR OLD.doctor_id <> (SELECT auth.uid())
               OR NEW.doctor_id <> OLD.doctor_id
               OR (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') THEN
                RAISE EXCEPTION 'Practitioners may only update status on their own consultations';
            END IF;
            RETURN NEW;
        END IF;
        IF v_role <> 'patient' OR NEW.patient_id <> (SELECT auth.uid()) THEN
            RAISE EXCEPTION 'Only patients may initiate their own consultations';
        END IF;
    ELSIF TG_TABLE_NAME = 'orders' THEN
        IF v_role <> 'patient' OR NEW.customer_id <> (SELECT auth.uid()) THEN
            RAISE EXCEPTION 'Only patients may place their own orders';
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

CREATE TRIGGER enforce_practitioner_details_role
    BEFORE UPDATE ON public.practitioner_details
    FOR EACH ROW EXECUTE FUNCTION public.enforce_rbac_write();
CREATE TRIGGER enforce_consultation_booking_role
    BEFORE INSERT ON public.consultations
    FOR EACH ROW WHEN (NEW.booking_status = 'pending_payment')
    EXECUTE FUNCTION public.enforce_rbac_write();
CREATE TRIGGER enforce_consultation_update_role
    BEFORE UPDATE ON public.consultations
    FOR EACH ROW EXECUTE FUNCTION public.enforce_rbac_write();
CREATE TRIGGER enforce_progress_feedback_role
    BEFORE UPDATE ON public.program_progress_logs
    FOR EACH ROW EXECUTE FUNCTION public.enforce_rbac_write();
CREATE TRIGGER enforce_shop_order_role
    BEFORE INSERT ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.enforce_rbac_write();
CREATE TRIGGER enforce_consultation_slot_role
    BEFORE INSERT OR UPDATE ON public.consultation_slots
    FOR EACH ROW EXECUTE FUNCTION public.enforce_rbac_write();
