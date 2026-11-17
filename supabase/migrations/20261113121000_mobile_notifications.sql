-- Mobile push notifications.

-- 1. The Expo push token of the patient's current device. The app writes it on sign-in and clears it on sign-out.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

-- 2. Outbox. A trigger writes a row in the same transaction as the event, so an alert is never lost if the
--    delivery service is down. send-push-alert delivers pending rows and records the outcome.
CREATE TABLE public.push_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
    body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 300),
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    attempts INT NOT NULL DEFAULT 0,
    last_error TEXT
);

CREATE INDEX push_outbox_pending_idx ON public.push_outbox (created_at) WHERE sent_at IS NULL;

ALTER TABLE public.push_outbox ENABLE ROW LEVEL SECURITY;

-- Only admins can read the outbox. Patients and practitioners never see other people's alerts.
-- The service role used by send-push-alert bypasses RLS.
CREATE POLICY "Admins read the push outbox" ON public.push_outbox
    FOR SELECT
    TO authenticated
    USING ((SELECT public.current_user_role()) = 'admin'::public.user_role);

REVOKE ALL ON public.push_outbox FROM anon, authenticated;
GRANT SELECT ON public.push_outbox TO authenticated;

CREATE OR REPLACE FUNCTION public.queue_push(p_recipient UUID, p_title TEXT, p_body TEXT, p_data JSONB)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    INSERT INTO public.push_outbox (recipient_id, title, body, data)
    SELECT p_recipient, p_title, p_body, COALESCE(p_data, '{}'::jsonb)
    WHERE p_recipient IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.queue_push(UUID, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;

-- 3. Events. Alert text never contains clinical content; the app opens the chat or booking to show it.

-- Booking confirmed: tell the patient and the doctor.
CREATE OR REPLACE FUNCTION public.notify_consultation_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_doctor TEXT;
    v_when TEXT;
BEGIN
    IF NEW.booking_status = 'confirmed' AND OLD.booking_status IS DISTINCT FROM 'confirmed' THEN
        SELECT p.full_name INTO v_doctor FROM public.profiles AS p WHERE p.id = NEW.doctor_id;
        v_when := to_char(NEW.slot_start AT TIME ZONE 'Asia/Kolkata', 'DD Mon, HH12:MI AM') || ' IST';
        PERFORM public.queue_push(
            NEW.patient_id, 'Consultation confirmed',
            'Your consultation with ' || COALESCE(v_doctor, 'your doctor') || ' is booked for ' || v_when || '.',
            jsonb_build_object('type', 'consultation', 'consultation_id', NEW.id)
        );
        PERFORM public.queue_push(
            NEW.doctor_id, 'New consultation booked',
            'A patient has booked a consultation for ' || v_when || '.',
            jsonb_build_object('type', 'consultation', 'consultation_id', NEW.id)
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER consultation_confirmed_push
    AFTER UPDATE OF booking_status ON public.consultations
    FOR EACH ROW EXECUTE FUNCTION public.notify_consultation_confirmed();

-- Follow-up chat message: tell the other party.
CREATE OR REPLACE FUNCTION public.notify_consultation_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_consultation RECORD;
    v_recipient UUID;
BEGIN
    SELECT c.patient_id, c.doctor_id INTO v_consultation
    FROM public.consultations AS c
    WHERE c.id = NEW.consultation_id;
    IF NOT FOUND THEN RETURN NEW; END IF;

    v_recipient := CASE WHEN NEW.sender_id = v_consultation.patient_id
                        THEN v_consultation.doctor_id ELSE v_consultation.patient_id END;
    PERFORM public.queue_push(
        v_recipient, 'New message',
        'Open your follow-up chat to read it.',
        jsonb_build_object('type', 'chat', 'consultation_id', NEW.consultation_id)
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER consultation_message_push
    AFTER INSERT ON public.consultation_messages
    FOR EACH ROW EXECUTE FUNCTION public.notify_consultation_message();

-- Programme chat message: tell the other party.
CREATE OR REPLACE FUNCTION public.notify_program_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_enrolment RECORD;
BEGIN
    SELECT e.patient_id, e.dietitian_id INTO v_enrolment
    FROM public.program_enrolments AS e
    WHERE e.id = NEW.enrolment_id;
    IF NOT FOUND THEN RETURN NEW; END IF;

    IF NEW.sender_id = v_enrolment.patient_id THEN
        PERFORM public.queue_push(
            v_enrolment.dietitian_id, 'New message from a client',
            'Open the programme chat to read it.',
            jsonb_build_object('type', 'program_chat', 'enrolment_id', NEW.enrolment_id)
        );
    ELSE
        PERFORM public.queue_push(
            v_enrolment.patient_id, 'New message from your dietitian',
            'Open your programme chat to read it.',
            jsonb_build_object('type', 'program_chat', 'enrolment_id', NEW.enrolment_id)
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER program_message_push
    AFTER INSERT ON public.program_messages
    FOR EACH ROW EXECUTE FUNCTION public.notify_program_message();

-- Programme activated: the webhook creates the enrolment once the payment is captured.
CREATE OR REPLACE FUNCTION public.notify_enrolment_active()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.status = 'active' THEN
        PERFORM public.queue_push(
            NEW.patient_id, 'Your plan is active',
            'Your programme has started. Open the app to see today''s plan.',
            jsonb_build_object('type', 'enrolment', 'enrolment_id', NEW.id)
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER enrolment_active_push
    AFTER INSERT ON public.program_enrolments
    FOR EACH ROW EXECUTE FUNCTION public.notify_enrolment_active();
