import { createClient } from "@supabase/supabase-js";
import type { Database } from "@healthoraa/types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fail at startup with a clear message instead of sending requests with an empty key.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in apps/patient-portal/.env.local");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
