// AGENTS.md lists services/ as the home of the Supabase client. The implementation lives in src/lib so every
// feature imports one path; this file re-exports it so both locations resolve to the same client.
export { supabase } from '../src/lib/supabase';
