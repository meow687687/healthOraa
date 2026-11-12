import { createClient } from "@supabase/supabase-js";
import type { Database } from "@healthoraa/types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_key";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
