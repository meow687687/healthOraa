import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifySignature } from "../_shared/razorpay.ts";
import { mockWebhookAllowed } from "../_shared/webhook-mode.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "content-type, x-razorpay-signature, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonResponse(body: JsonObject, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const mockAllowed = mockWebhookAllowed({
    secret,
    allowMock: Deno.env.get("ALLOW_MOCK_WEBHOOK"),
    supabaseUrl,
  });
  if (!secret && !mockAllowed) {
    return jsonResponse({ error: "Webhook is not configured" }, 500);
  }

  const rawBody = new Uint8Array(await request.arrayBuffer());
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  if (
    !mockAllowed &&
    (!secret || !(await verifySignature(rawBody, signature, secret)))
  ) {
    return jsonResponse({ error: "Invalid webhook signature" }, 401);
  }

  let event: unknown;
  try {
    event = JSON.parse(new TextDecoder().decode(rawBody));
  } catch {
    return jsonResponse({ error: "Invalid JSON payload" }, 400);
  }
  if (
    !isObject(event) ||
    (event.event !== "payment.captured" && event.event !== "payment.failed")
  ) {
    return jsonResponse({ error: "Unsupported webhook event" }, 400);
  }
  const payload = isObject(event.payload) && isObject(event.payload.payment)
    ? event.payload.payment
    : null;
  const payment = payload && isObject(payload.entity) ? payload.entity : null;
  const orderId = payment?.order_id;
  const paymentId = payment?.id;
  const amount = payment?.amount;
  const currency = payment?.currency;
  if (
    !payment || typeof orderId !== "string" || !orderId ||
    typeof paymentId !== "string" || !paymentId ||
    !Number.isSafeInteger(amount) || (amount as number) <= 0 ||
    typeof currency !== "string"
  ) return jsonResponse({ error: "Invalid payment entity" }, 400);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: "Database is not configured" }, 500);
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: orderLog, error: lookupError } = await supabase
    .from("razorpay_order_logs")
    .select(
      "order_id,user_id,amount_paise,currency,status,entity_type,entity_id",
    )
    .eq("order_id", orderId)
    .maybeSingle();
  if (lookupError) {
    return jsonResponse({ error: "Could not load payment order" }, 500);
  }
  if (!orderLog) return jsonResponse({ error: "Unknown payment order" }, 404);
  if (orderLog.amount_paise !== amount || orderLog.currency !== currency) {
    return jsonResponse(
      { error: "Payment does not match the recorded order" },
      409,
    );
  }

  const captured = event.event === "payment.captured";
  const { data: priorPayment, error: priorError } = await supabase.from(
    "payment_transactions",
  )
    .select("id,status")
    .eq("gateway_payment_id", paymentId)
    .maybeSingle();
  if (priorError) {
    return jsonResponse({ error: "Could not check payment audit" }, 500);
  }
  const alreadyCaptured = priorPayment?.status === "captured";
  const status = captured || alreadyCaptured ? "captured" : "failed";
  const { error: logError } = await supabase.from("razorpay_order_logs")
    .update({ status })
    .eq("order_id", orderId)
    .neq("status", "captured");
  if (logError) {
    return jsonResponse({ error: "Could not update payment order" }, 500);
  }

  const errorEntity = isObject(payment.error) ? payment.error : {};
  const transaction = {
    gateway: "razorpay",
    gateway_payment_id: paymentId,
    gateway_order_id: orderId,
    amount_inr: (amount as number) / 100,
    currency,
    status,
    error_code: status === "captured"
      ? null
      : typeof errorEntity.code === "string"
      ? errorEntity.code
      : null,
    error_description: status === "captured"
      ? null
      : typeof errorEntity.description === "string"
      ? errorEntity.description
      : null,
    order_id: orderLog.entity_type === "shop_order" ? orderLog.entity_id : null,
    consultation_id: orderLog.entity_type === "consultation"
      ? orderLog.entity_id
      : null,
  };
  const { error: transactionError } = await supabase.from(
    "payment_transactions",
  )
    .upsert(transaction, { onConflict: "gateway_payment_id" });
  if (transactionError) {
    return jsonResponse({ error: "Could not save payment audit" }, 500);
  }

  if (status !== "captured") {
    return jsonResponse({
      received: true,
      status,
      duplicate: Boolean(priorPayment),
    });
  }

  if (orderLog.entity_type === "consultation") {
    const { data: confirmed, error } = await supabase
      .from("consultations")
      .update({ booking_status: "confirmed" })
      .eq("id", orderLog.entity_id)
      .eq("patient_id", orderLog.user_id)
      .eq("payment_order_id", orderId)
      .eq("booking_status", "pending_payment")
      .select("id");
    if (error) {
      return jsonResponse({
        error: "Payment saved, but consultation confirmation failed",
      }, 500);
    }
    if (!confirmed?.length) {
      // An earlier delivery already confirmed it, or the booking was cancelled. A cancelled
      // booking is never confirmed here; its payment stays in the audit for a refund.
      const { data: booking } = await supabase
        .from("consultations")
        .select("booking_status")
        .eq("id", orderLog.entity_id)
        .maybeSingle();
      return jsonResponse({
        received: true,
        status,
        entity_type: orderLog.entity_type,
        booking_status: booking?.booking_status ?? null,
        refund_review: booking?.booking_status === "cancelled",
      });
    }
  } else if (orderLog.entity_type === "shop_order") {
    const { error } = await supabase.from("orders").update({ status: "paid" })
      .eq("id", orderLog.entity_id).eq("customer_id", orderLog.user_id).eq(
        "status",
        "pending",
      );
    if (error) {
      return jsonResponse({
        error: "Payment saved, but order confirmation failed",
      }, 500);
    }
  } else if (orderLog.entity_type === "program") {
    const { data: program, error: programError } = await supabase.from(
      "programs",
    )
      .select("id,duration_days,is_active").eq("id", orderLog.entity_id)
      .maybeSingle();
    if (programError || !program || !program.is_active) {
      return jsonResponse({
        error: "Payment saved, but program is unavailable",
      }, 500);
    }
    const { data: activeEnrolment, error: enrolmentLookupError } =
      await supabase.from("program_enrolments")
        .select("id")
        .eq("patient_id", orderLog.user_id)
        .eq("program_id", orderLog.entity_id)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .limit(1)
        .maybeSingle();
    if (enrolmentLookupError) {
      return jsonResponse({ error: "Could not check existing enrolment" }, 500);
    }
    if (!activeEnrolment) {
      const { error } = await supabase.from("program_enrolments").insert({
        patient_id: orderLog.user_id,
        program_id: orderLog.entity_id,
        started_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + program.duration_days * 86_400_000)
          .toISOString(),
        status: "active",
      });
      if (error) {
        // 23505 means an active row already holds this program slot. It is success only when that row
        // is an unexpired enrolment. An expired row still marked active blocks the new one, and the
        // payment then needs a human decision, so the request fails loudly.
        if (error.code !== "23505") {
          return jsonResponse({
            error: "Payment saved, but enrolment creation failed",
          }, 500);
        }
        const { data: liveEnrolment, error: liveError } = await supabase
          .from("program_enrolments")
          .select("id")
          .eq("patient_id", orderLog.user_id)
          .eq("program_id", orderLog.entity_id)
          .eq("status", "active")
          .gt("expires_at", new Date().toISOString())
          .limit(1)
          .maybeSingle();
        if (liveError || !liveEnrolment) {
          return jsonResponse({
            error:
              "Payment saved, but an expired active enrolment blocks the new one. Needs manual enrolment repair.",
          }, 500);
        }
      }
    }
  } else {
    return jsonResponse({ error: "Unsupported payment entity type" }, 400);
  }

  return jsonResponse({
    received: true,
    status,
    entity_type: orderLog.entity_type,
  });
});
