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
  registration_version: string;
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
  const now = new Date();
  const nowIso = now.toISOString();
  const receiptRetryAt = new Date(now.getTime() + RECEIPT_DELAY_MS).toISOString();
  const receiptMaxAgeAt = new Date(Date.now() - RECEIPT_MAX_AGE_MS).toISOString();
  const staleDispatchAt = new Date(now.getTime() - RECEIPT_DELAY_MS).toISOString();
  const { error: staleDispatchError } = await admin.from("push_outbox")
    .update({
      delivery_state: "unknown",
      delivery_claimed_at: null,
      last_error: "The worker stopped after claiming this alert. Delivery outcome is unknown; it will not be resent automatically.",
    })
    .eq("delivery_state", "sending")
    .lte("delivery_claimed_at", staleDispatchAt);
  if (staleDispatchError) return json({ error: "Could not reconcile interrupted alert deliveries." }, 500);

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
        receipt_checked_at: nowIso,
        last_error: "No Expo receipt was available within 24 hours.",
        receipt_next_check_at: null,
      })
      .in("id", staleReceipts.map((row) => row.id))
      .is("receipt_checked_at", null);
    if (error) return json({ error: "Could not age out stale push receipts." }, 500);
  }

  const { data: receiptRows, error: receiptRowsError } = await admin
    .from("push_outbox")
    .select("id, recipient_id, expo_ticket_id, expo_token_registration_version")
    .not("expo_ticket_id", "is", null)
    .is("receipt_checked_at", null)
    .lte("receipt_next_check_at", nowIso)
    .order("receipt_next_check_at", { ascending: true })
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
        signal: AbortSignal.timeout(10_000),
      });
      const payload = (await response.json()) as { data?: Record<string, ExpoReceipt> };
      if (!response.ok || !payload.data || typeof payload.data !== "object") {
        receiptRequestFailed = true;
      } else {
        const checkedAt = new Date().toISOString();
        for (const row of receipts) {
          const receipt = row.expo_ticket_id ? payload.data[row.expo_ticket_id] : undefined;
          // Expo may not have a receipt ready yet. Delay its next check so younger tickets can use this batch.
          if (!receipt) {
            const { error: retryScheduleError } = await admin.from("push_outbox")
              .update({ receipt_next_check_at: receiptRetryAt })
              .eq("id", row.id);
            if (retryScheduleError) receiptRequestFailed = true;
            continue;
          }

          const errorCode = receipt.details?.error;
          if (receipt.status === "error" && errorCode === "DeviceNotRegistered" && row.expo_token_registration_version) {
            // Delete only the token used for this ticket. A newer registration survives this old receipt.
            const { error: tokenDeleteError } = await admin.from("patient_push_tokens")
              .delete()
              .eq("user_id", row.recipient_id)
              .eq("registration_version", row.expo_token_registration_version);
            if (tokenDeleteError) {
              receiptRequestFailed = true;
              continue;
            }
          }

          const receiptError = receipt.status === "error"
            ? receipt.message ?? errorCode ?? "The push service could not deliver this alert."
            : null;
          const { error: updateError } = await admin.from("push_outbox")
            .update({ receipt_checked_at: checkedAt, last_error: receiptError, receipt_next_check_at: null })
            .eq("id", row.id);
          if (!updateError) receiptsChecked += 1;
          else receiptRequestFailed = true;
        }
      }
    } catch {
      receiptRequestFailed = true;
    }
    if (receiptRequestFailed) {
      const { error: scheduleError } = await admin.from("push_outbox")
        .update({ receipt_next_check_at: receiptRetryAt })
        .in("id", receipts.map((row) => row.id))
        .is("receipt_checked_at", null);
      if (scheduleError) return json({ error: "Could not schedule push receipt retries." }, 500);
    }
  }

  const { data: rows, error: rowsError } = await admin
    .from("push_outbox")
    .select("id, recipient_id, title, body, data, attempts")
    .eq("delivery_state", "pending")
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(BATCH);
  if (rowsError) return json({ error: "Could not read the outbox." }, 500);
  const pending = (rows ?? []) as OutboxRow[];
  if (pending.length === 0) {
    return json({ processed: 0, sent: 0, failed: 0, skipped: 0, delivery_unknown: 0, receipts_checked: receiptsChecked, receipt_request_failed: receiptRequestFailed }, 200);
  }

  const recipientIds = [...new Set(pending.map((row) => row.recipient_id))];
  const [{ data: profiles, error: profileError }, { data: tokens, error: tokenError }] = await Promise.all([
    admin.from("profiles").select("id, deleted_at").in("id", recipientIds),
    admin.from("patient_push_tokens").select("user_id, expo_push_token, updated_at, registration_version").in("user_id", recipientIds),
  ]);
  if (profileError) return json({ error: "Could not read recipients." }, 500);
  if (tokenError) return json({ error: "Could not read device tokens." }, 500);
  const deletedRecipients = new Set((profiles ?? []).filter((profile) => profile.deleted_at !== null).map((profile) => profile.id));
  const tokenFor = new Map<string, ExpoTokenRow>(
    ((tokens ?? []) as ExpoTokenRow[]).map((token) => [token.user_id, token]),
  );

  const sentAt = new Date().toISOString();
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let deliveryUnknown = 0;
  let deliveryStateWriteFailed = false;
  const deliverable: Array<{ row: OutboxRow; token: ExpoTokenRow }> = [];

  for (const row of pending) {
    const token = deletedRecipients.has(row.recipient_id) ? undefined : tokenFor.get(row.recipient_id);
    if (!token) {
      const { data: skippedRow, error } = await admin.from("push_outbox")
        .update({ delivery_state: "failed", sent_at: sentAt, attempts: row.attempts + 1, last_error: "No device token on file." })
        .eq("id", row.id)
        .eq("delivery_state", "pending")
        .select("id")
        .maybeSingle();
      if (error) return json({ error: "Could not record a skipped alert." }, 500);
      if (skippedRow) skipped += 1;
      continue;
    }
    deliverable.push({ row, token });
  }

  for (let start = 0; start < deliverable.length; start += BATCH) {
    const requestedBatch = deliverable.slice(start, start + BATCH);
    const claimAt = new Date().toISOString();
    const claimIds = requestedBatch.map(({ row }) => row.id);
    const { data: claimedRows, error: claimError } = await admin.from("push_outbox")
      .update({ delivery_state: "sending", delivery_claimed_at: claimAt })
      .in("id", claimIds)
      .eq("delivery_state", "pending")
      .select("id");
    if (claimError) return json({ error: "Could not claim pending alerts." }, 500);
    const claimedIds = new Set((claimedRows ?? []).map((row) => row.id));
    const batch = requestedBatch.filter(({ row }) => claimedIds.has(row.id));
    if (batch.length === 0) continue;
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
        signal: AbortSignal.timeout(10_000),
      });
      const payload = (await response.json()) as { data?: ExpoTicket[] };
      tickets = response.ok && Array.isArray(payload.data) ? payload.data : null;
    } catch {
      tickets = null;
    }

    if (!tickets) {
      deliveryUnknown += batch.length;
      for (const { row } of batch) {
        const { error } = await admin.from("push_outbox")
          .update({
            delivery_state: "unknown",
            delivery_claimed_at: null,
            attempts: row.attempts + 1,
            last_error: "Expo did not return a usable response. Delivery outcome is unknown; this alert will not be resent automatically.",
          })
          .eq("id", row.id)
          .eq("delivery_state", "sending");
        if (error) deliveryStateWriteFailed = true;
      }
      continue;
    }

    for (let index = 0; index < batch.length; index += 1) {
      const { row, token } = batch[index];
      const ticket = tickets?.[index];
      if (ticket?.status === "ok") {
        const acceptedUpdate = {
          delivery_state: "sent",
          delivery_claimed_at: null,
          sent_at: sentAt,
          last_error: ticket.id ? null : "Expo accepted the alert without returning a receipt id.",
          attempts: row.attempts + 1,
          expo_ticket_id: ticket.id ?? null,
          expo_token_registration_version: token.registration_version,
          receipt_next_check_at: ticket.id ? new Date(Date.now() + RECEIPT_DELAY_MS).toISOString() : null,
        };
        let { error: sentError } = await admin.from("push_outbox").update(acceptedUpdate)
          .eq("id", row.id)
          .eq("delivery_state", "sending");
        if (sentError) {
          const retry = await admin.from("push_outbox").update(acceptedUpdate)
            .eq("id", row.id)
            .eq("delivery_state", "sending");
          sentError = retry.error;
        }
        if (sentError) {
          deliveryUnknown += 1;
          deliveryStateWriteFailed = true;
        } else {
          sent += 1;
        }
        continue;
      }
      if (ticket?.status !== "error") {
        deliveryUnknown += 1;
        const { error } = await admin.from("push_outbox")
          .update({
            delivery_state: "unknown",
            delivery_claimed_at: null,
            attempts: row.attempts + 1,
            last_error: "Expo omitted the ticket for this alert. Delivery outcome is unknown; this alert will not be resent automatically.",
          })
          .eq("id", row.id)
          .eq("delivery_state", "sending");
        if (error) deliveryStateWriteFailed = true;
        continue;
      }
      failed += 1;
      let tokenDeleteFailed = false;
      if (ticket?.details?.error === "DeviceNotRegistered") {
        // Avoid deleting a newer token registered while this send was in flight.
        const { error: tokenDeleteError } = await admin.from("patient_push_tokens").delete()
          .eq("user_id", row.recipient_id)
          .eq("registration_version", token.registration_version);
        if (tokenDeleteError) {
          tokenDeleteFailed = true;
          deliveryStateWriteFailed = true;
        }
      }
      const { error: failureError } = await admin.from("push_outbox")
        .update({
          delivery_state: tokenDeleteFailed || row.attempts + 1 >= MAX_ATTEMPTS ? "failed" : "pending",
          delivery_claimed_at: null,
          attempts: row.attempts + 1,
          last_error: tokenDeleteFailed
            ? "Expo rejected this device token, but the invalid token could not be removed."
            : ticket?.message ?? "The push service did not respond.",
        })
        .eq("id", row.id)
        .eq("delivery_state", "sending");
      if (failureError) deliveryStateWriteFailed = true;
    }
  }

  if (deliveryStateWriteFailed) {
    return json({ error: "Some delivery or token updates failed; verify the outbox before retrying the worker." }, 500);
  }

  return json({
    processed: pending.length,
    sent,
    failed,
    skipped,
    delivery_unknown: deliveryUnknown,
    receipts_checked: receiptsChecked,
    receipt_request_failed: receiptRequestFailed,
  }, 200);
});
