import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@healthoraa/types";

export type TableName = keyof Database["public"]["Tables"];

export interface TableWatch {
  table: TableName;
  events: ("INSERT" | "UPDATE")[];
  // PostgREST filter such as "doctor_id=eq.<uuid>". Omit to receive every row RLS allows.
  filter?: string;
}

// Subscribes to Postgres row changes and returns a cleanup for effects.
// Realtime applies RLS, so a subscriber only receives rows it could SELECT.
// Each call gets a unique channel topic: supabase-js returns the existing channel for a
// repeated topic, and a torn-down channel would silently drop events under StrictMode.
export function watchTables<Row = Record<string, unknown>>(
  client: SupabaseClient<Database>,
  topic: string,
  watches: TableWatch[],
  onRow: (row: Row) => void,
): () => void {
  let channel = client.channel(`${topic}:${crypto.randomUUID()}`);
  for (const watch of watches) {
    for (const event of watch.events) {
      channel = channel.on(
        "postgres_changes",
        { event, schema: "public", table: watch.table, filter: watch.filter },
        (payload) => onRow(payload.new as Row),
      );
    }
  }
  channel.subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}
