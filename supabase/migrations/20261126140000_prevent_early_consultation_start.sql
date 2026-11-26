CREATE OR REPLACE FUNCTION public.prevent_early_consultation_start()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF OLD.status = 'scheduled'
       AND NEW.status = 'in_progress'
       AND OLD.slot_start > clock_timestamp() THEN
        RAISE EXCEPTION 'Consultation cannot start before its scheduled time';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS consultations_prevent_early_start ON public.consultations;
CREATE TRIGGER consultations_prevent_early_start
    BEFORE UPDATE OF status ON public.consultations
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_early_consultation_start();
