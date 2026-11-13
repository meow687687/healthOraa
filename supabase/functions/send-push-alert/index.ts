import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Delivers queued alerts (push_outbox) through the Expo push service, which relays to FCM and APNs.
// Only the service role may call it, because it reads every queued alert. Schedule it with a cron job.

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const MAX_ATTEMPTS = 5;
const BATCH = 100;

interface OutboxRow {
  id: string;
  recipient_id: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  attempts: number;
}

interface ExpoTicket {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

const json = (body: Record<string, unknown>, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const header = request.headers.get("authorization") ?? "";
  if (!serviceKey || !supabaseUrl) return json({ error: "The server is not configured." }, 500);
  if (header !== `Bearer ${serviceKey}`) return json({ error: "Only the scheduler may send alerts." }, 401);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: rows, error: rowsError } = await admin
    .from("push_outbox")
    .select("id, recipient_id, title, body, data, attempts")
    .is("sent_at", null)
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(BATCH);
  if (rowsError) return json({ error: "Could not read the outbox." }, 500);
  const pending = (rows ?? []) as OutboxRow[];
  if (pending.length === 0) return json({ processed: 0, sent: 0, failed: 0, skipped: 0 }, 200);

  const recipientIds = [...new Set(pending.map((row) => row.recipient_id))];
  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("id, expo_push_token, deleted_at")
    .in("id", recipientIds);
  if (profileError) return json({ error: "Could not read recipients." }, 500);
  const tokenFor = new Map<string, string | null>(
    (profiles ?? []).map((profile) => [
      profile.id,
      profile.deleted_at === null ? profile.expo_push_token : null,
    ]),
  );

  const now = new Date().toISOString();
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const deliverable: Array<{ row: OutboxRow; token: string }> = [];

  for (const row of pending) {
    const token = tokenFor.get(row.recipient_id);
    if (!token) {
      skipped += 1;
      await admin.from("push_outbox")
        .update({ sent_at: now, last_error: "No device token on file." })
        .eq("id", row.id);
      continue;
    }
    deliverable.push({ row, token });
  }

  for (let start = 0; start < deliverable.length; start += BATCH) {
    const batch = deliverable.slice(start, start + BATCH);
    const messages = batch.map(({ row, token }) => ({
      to: token,
      title: row.title,
      body: row.body,
      data: row.data,
      sound: "default",
      priority: "high",
    }));

    let tickets: ExpoTicket[] | null = null;
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify(messages),
      });
      const payload = (await response.json()) as { data?: ExpoTicket[] };
      tickets = Array.isArray(payload.data) ? payload.data : null;
    } catch {
      tickets = null;
    }

    for (let index = 0; index < batch.length; index += 1) {
      const { row, token } = batch[index];
      const ticket = tickets?.[index];
      if (ticket?.status === "ok") {
        sent += 1;
        await admin.from("push_outbox").update({ sent_at: now, last_error: null, attempts: row.attempts + 1 })
          .eq("id", row.id);
        continue;
      }
      failed += 1;
      if (ticket?.details?.error === "DeviceNotRegistered") {
        // The device uninstalled the app or revoked permission. Stop sending to that token.
        await admin.from("profiles").update({ expo_push_token: null }).eq("expo_push_token", token);
      }
      await admin.from("push_outbox")
        .update({
          attempts: row.attempts + 1,
          last_error: ticket?.message ?? "The push service did not respond.",
        })
        .eq("id", row.id);
    }
  }

  return json({ processed: pending.length, sent, failed, skipped }, 200);
});
