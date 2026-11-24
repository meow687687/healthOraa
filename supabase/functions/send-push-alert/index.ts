import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Delivers queued alerts (push_outbox) through the Expo push service, which relays to FCM and APNs.
// Only the service role may call it, because it reads every queued alert. Schedule it with a cron job.

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const MAX_ATTEMPTS = 5;
const BATCH = 100;
const RECEIPT_BATCH = 300;
const RECEIPT_DELAY_MS = 15 * 60 * 1000;
const RECEIPT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface OutboxRow {
  id: string;
  recipient_id: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  attempts: number;
}

interface ExpoTicket {
  id?: string;
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

interface ExpoReceipt {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

interface ExpoTokenRow {
  user_id: string;
  expo_push_token: string;
  updated_at: string;
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
  const receiptReadyAt = new Date(Date.now() - RECEIPT_DELAY_MS).toISOString();
  const receiptMaxAgeAt = new Date(Date.now() - RECEIPT_MAX_AGE_MS).toISOString();
  const staleReceiptCheckedAt = new Date().toISOString();
  const { data: staleReceipts, error: staleReceiptsError } = await admin.from("push_outbox")
    .select("id")
    .not("expo_ticket_id", "is", null)
    .is("receipt_checked_at", null)
    .lte("sent_at", receiptMaxAgeAt)
    .order("sent_at", { ascending: true })
    .limit(RECEIPT_BATCH);
  if (staleReceiptsError) return json({ error: "Could not age out stale push receipts." }, 500);
  if (staleReceipts?.length) {
    const { error } = await admin.from("push_outbox")
      .update({
        receipt_checked_at: staleReceiptCheckedAt,
        last_error: "No Expo receipt was available within 24 hours.",
      })
      .in("id", staleReceipts.map((row) => row.id));
    if (error) return json({ error: "Could not age out stale push receipts." }, 500);
  }

  const { data: receiptRows, error: receiptRowsError } = await admin
    .from("push_outbox")
    .select("id, recipient_id, expo_ticket_id, expo_token_updated_at")
    .not("expo_ticket_id", "is", null)
    .is("receipt_checked_at", null)
    .lte("sent_at", receiptReadyAt)
    .order("sent_at", { ascending: true })
    .limit(RECEIPT_BATCH);
  if (receiptRowsError) return json({ error: "Could not read push receipts." }, 500);

  const receipts = receiptRows ?? [];
  let receiptsChecked = 0;
  let receiptRequestFailed = false;
  if (receipts.length > 0) {
    try {
      const response = await fetch(EXPO_RECEIPTS_URL, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ ids: receipts.map((row) => row.expo_ticket_id) }),
      });
      const payload = (await response.json()) as { data?: Record<string, ExpoReceipt> };
      if (!response.ok || !payload.data || typeof payload.data !== "object") {
        receiptRequestFailed = true;
      } else {
        const checkedAt = new Date().toISOString();
        for (const row of receipts) {
          const receipt = row.expo_ticket_id ? payload.data[row.expo_ticket_id] : undefined;
          // Expo may not have a receipt ready yet. Leave this row pending for the next worker run.
          if (!receipt) continue;

          const errorCode = receipt.details?.error;
          if (receipt.status === "error" && errorCode === "DeviceNotRegistered" && row.expo_token_updated_at) {
            // Delete only the token used for this ticket. A newer registration survives this old receipt.
            await admin.from("patient_push_tokens")
              .delete()
              .eq("user_id", row.recipient_id)
              .eq("updated_at", row.expo_token_updated_at);
          }

          const receiptError = receipt.status === "error"
            ? receipt.message ?? errorCode ?? "The push service could not deliver this alert."
            : null;
          const { error: updateError } = await admin.from("push_outbox")
            .update({ receipt_checked_at: checkedAt, last_error: receiptError })
            .eq("id", row.id);
          if (!updateError) receiptsChecked += 1;
        }
      }
    } catch {
      receiptRequestFailed = true;
    }
  }

  const { data: rows, error: rowsError } = await admin
    .from("push_outbox")
    .select("id, recipient_id, title, body, data, attempts")
    .is("sent_at", null)
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(BATCH);
  if (rowsError) return json({ error: "Could not read the outbox." }, 500);
  const pending = (rows ?? []) as OutboxRow[];
  if (pending.length === 0) {
    return json({ processed: 0, sent: 0, failed: 0, skipped: 0, receipts_checked: receiptsChecked, receipt_request_failed: receiptRequestFailed }, 200);
  }

  const recipientIds = [...new Set(pending.map((row) => row.recipient_id))];
  const [{ data: profiles, error: profileError }, { data: tokens, error: tokenError }] = await Promise.all([
    admin.from("profiles").select("id, deleted_at").in("id", recipientIds),
    admin.from("patient_push_tokens").select("user_id, expo_push_token, updated_at").in("user_id", recipientIds),
  ]);
  if (profileError) return json({ error: "Could not read recipients." }, 500);
  if (tokenError) return json({ error: "Could not read device tokens." }, 500);
  const deletedRecipients = new Set((profiles ?? []).filter((profile) => profile.deleted_at !== null).map((profile) => profile.id));
  const tokenFor = new Map<string, ExpoTokenRow>(
    ((tokens ?? []) as ExpoTokenRow[]).map((token) => [token.user_id, token]),
  );

  const now = new Date().toISOString();
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const deliverable: Array<{ row: OutboxRow; token: ExpoTokenRow }> = [];

  for (const row of pending) {
    const token = deletedRecipients.has(row.recipient_id) ? undefined : tokenFor.get(row.recipient_id);
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
      to: token.expo_push_token,
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
      tickets = response.ok && Array.isArray(payload.data) ? payload.data : null;
    } catch {
      tickets = null;
    }

    for (let index = 0; index < batch.length; index += 1) {
      const { row, token } = batch[index];
      const ticket = tickets?.[index];
      if (ticket?.status === "ok") {
        sent += 1;
        await admin.from("push_outbox").update({
          sent_at: now,
          last_error: ticket.id ? null : "Expo accepted the alert without returning a receipt id.",
          attempts: row.attempts + 1,
          expo_ticket_id: ticket.id ?? null,
          expo_token_updated_at: token.updated_at,
        })
          .eq("id", row.id);
        continue;
      }
      failed += 1;
      if (ticket?.details?.error === "DeviceNotRegistered") {
        // Avoid deleting a newer token registered while this send was in flight.
        await admin.from("patient_push_tokens").delete()
          .eq("user_id", row.recipient_id)
          .eq("updated_at", token.updated_at);
      }
      await admin.from("push_outbox")
        .update({
          attempts: row.attempts + 1,
          last_error: ticket?.message ?? "The push service did not respond.",
        })
        .eq("id", row.id);
    }
  }

  return json({
    processed: pending.length,
    sent,
    failed,
    skipped,
    receipts_checked: receiptsChecked,
    receipt_request_failed: receiptRequestFailed,
  }, 200);
});
