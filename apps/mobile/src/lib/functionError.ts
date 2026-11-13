import { FunctionsHttpError } from '@supabase/supabase-js';

// Edge Functions answer errors with a JSON body that holds the message to show. Other failures
// (network, relay) carry their own text.
export async function functionErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const body = (await error.context.json().catch(() => null)) as { error?: string } | null;
    return body?.error ?? fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
