-- Publishes the tables the portals subscribe to with postgres_changes.
-- Realtime applies each table's RLS policies to every subscriber, so membership
-- in the publication grants no extra access.
DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'consultations',
        'consultation_messages',
        'prescriptions',
        'orders',
        'payment_transactions'
    ] LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = table_name
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
        END IF;
    END LOOP;
END;
$$;
