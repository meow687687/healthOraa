-- Customer mobile app access.

-- 1. Every new sign-up gets a patient profile. The role is fixed to 'patient' here and is never read from
--    the client's metadata, so no sign-up can request another role.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, role, full_name)
    VALUES (
        NEW.id,
        'patient',
        COALESCE(NULLIF(btrim(NEW.raw_user_meta_data ->> 'full_name'), ''), 'Patient')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Patients can place orders for themselves. Before this policy, every checkout was refused with a
--    row-level security error. The enforce_shop_order_role trigger applies the same rule again.
CREATE POLICY "Patients place own orders" ON public.orders
    FOR INSERT
    TO authenticated
    WITH CHECK (
        customer_id = (SELECT auth.uid())
        AND (SELECT public.current_user_role()) = 'patient'::user_role
    );
