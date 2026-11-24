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
  if (!isObject(event)) {
    return jsonResponse({ error: "Unsupported webhook event" }, 400);
  }
  const eventName = event.event;
  const isRefundEvent = eventName === "refund.created" || eventName === "refund.processed" || eventName === "refund.failed";
  if (!isRefundEvent && eventName !== "payment.captured" && eventName !== "payment.failed") {
    return jsonResponse({ error: "Unsupported webhook event" }, 400);
  }
  const payload = isObject(event.payload) && isObject(event.payload.payment)
    ? event.payload.payment
    : null;
  const payment = payload && isObject(payload.entity) ? payload.entity : null;
  const refundPayload = isObject(event.payload) && isObject(event.payload.refund)
    ? event.payload.refund
    : null;
  const refund = refundPayload && isObject(refundPayload.entity) ? refundPayload.entity : null;
  const orderId = payment?.order_id;
  const paymentId = payment?.id;
  const amount = payment?.amount;
  const currency = payment?.currency;
  if (
    !payment || typeof paymentId !== "string" || !paymentId ||
    (isRefundEvent
      ? !refund || refund.payment_id !== paymentId || typeof refund.id !== "string" ||
        !refund.id || !Number.isSafeInteger(refund.amount) || (refund.amount as number) <= 0
      : typeof orderId !== "string" || !orderId || !Number.isSafeInteger(amount) ||
        (amount as number) <= 0 || typeof currency !== "string")
  ) return jsonResponse({ error: isRefundEvent ? "Invalid refund entity" : "Invalid payment entity" }, 400);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: "Database is not configured" }, 500);
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  if (isRefundEvent && refund) {
    const { data: transaction, error: transactionError } = await supabase.from("payment_transactions")
      .select("amount_inr")
      .eq("gateway_payment_id", paymentId)
      .maybeSingle();
    if (transactionError) return jsonResponse({ error: "Could not load refund audit" }, 500);
    if (!transaction) return jsonResponse({ received: true, ignored: true });

    const refundId = refund.id as string;
    const { data: review, error: reviewError } = await supabase.from("payment_refund_reviews")
      .select("refund_id,status")
      .eq("gateway_payment_id", paymentId)
      .maybeSingle();
    if (reviewError) return jsonResponse({ error: "Could not load refund review" }, 500);
    if (review?.refund_id && review.refund_id !== refundId) {
      return jsonResponse({ received: true, ignored: true });
    }

    if (eventName === "refund.created") {
      if (review?.status === "pending") {
        const { error } = await supabase.from("payment_refund_reviews")
          .update({ refund_id: refundId })
          .eq("gateway_payment_id", paymentId)
          .eq("status", "pending");
        if (error) return jsonResponse({ error: "Could not save refund reference" }, 500);
      }
      return jsonResponse({ received: true, status: "refund_pending" });
    }

    if (eventName === "refund.failed") {
      if (review?.status === "pending") {
        const { error } = await supabase.from("payment_refund_reviews")
          .update({
            refund_id: null,
            reason: "The automatic refund failed. Issue a refund in Razorpay and record its ID here.",
          })
          .eq("gateway_payment_id", paymentId)
          .eq("status", "pending");
        if (error) return jsonResponse({ error: "Could not update refund review" }, 500);
      }
      return jsonResponse({ received: true, status: "refund_failed" });
    }

    const isFullRefund = Number.isFinite(Number(transaction.amount_inr)) &&
      refund.amount === Math.round(Number(transaction.amount_inr) * 100);
    if (!isFullRefund) {
      if (review?.status === "pending") {
        const { error } = await supabase.from("payment_refund_reviews")
          .update({
            refund_id: null,
            reason: "The provider completed a partial refund. Verify the remaining balance and record the final refund here.",
          })
          .eq("gateway_payment_id", paymentId)
          .eq("status", "pending");
        if (error) return jsonResponse({ error: "Could not update refund review" }, 500);
      }
      return jsonResponse({ received: true, status: "partial_refund_review" });
    }

    const resolvedAt = new Date().toISOString();
    const { error: paymentUpdateError } = await supabase.from("payment_transactions")
      .update({ status: "refunded" })
      .eq("gateway_payment_id", paymentId);
    if (paymentUpdateError) return jsonResponse({ error: "Could not record completed refund" }, 500);
    if (review?.status === "pending") {
      const { error } = await supabase.from("payment_refund_reviews")
        .update({ refund_id: refundId, status: "resolved", resolved_at: resolvedAt })
        .eq("gateway_payment_id", paymentId)
        .eq("status", "pending");
      if (error) return jsonResponse({ error: "Could not resolve refund review" }, 500);
    }
    if (typeof orderId === "string") {
      const { error } = await supabase.from("razorpay_order_logs")
        .update({ status: "refunded" })
        .eq("order_id", orderId)
        .eq("status", "refund_review");
      if (error) return jsonResponse({ error: "Could not update refunded order" }, 500);
    }
    return jsonResponse({ received: true, status: "refunded" });
  }

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
  if (orderLog.status === "refunded") {
    return jsonResponse({
      received: true,
      status: "refunded",
      duplicate: true,
      entity_type: orderLog.entity_type,
    });
  }

  const captured = event.event === "payment.captured";
  let paymentOrderUsable = ["created", "captured", "fulfilled"].includes(orderLog.status);
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
  if (captured && paymentOrderUsable) {
    const { data: activeLog, error: logError } = await supabase.from("razorpay_order_logs")
      .update({ status: "captured" })
      .eq("order_id", orderId)
      .in("status", ["created", "captured"])
      .select("status")
      .maybeSingle();
    if (logError) return jsonResponse({ error: "Could not update payment order" }, 500);
    if (activeLog) {
      orderLog.status = activeLog.status;
    } else {
      // A concurrent expiry or price change may have superseded the order after the initial lookup.
      const { data: latestLog, error: latestError } = await supabase.from("razorpay_order_logs")
        .select("status").eq("order_id", orderId).maybeSingle();
      if (latestError) return jsonResponse({ error: "Could not recheck payment order" }, 500);
      orderLog.status = latestLog?.status ?? "superseded";
      paymentOrderUsable = ["captured", "fulfilled"].includes(orderLog.status);
    }
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

  const recordRefundReview = async (
    reason: string,
  ): Promise<"recorded" | "fulfilled" | "refunded" | "error"> => {
    const { data: updatedLog, error: logError } = await supabase.from("razorpay_order_logs")
      .update({ status: "refund_review" })
      .eq("order_id", orderId)
      .in("status", ["created", "superseded", "failed", "captured", "refund_review"])
      .select("status")
      .maybeSingle();
    if (logError) return "error";
    if (!updatedLog) {
      const { data: latestLog, error: latestError } = await supabase.from("razorpay_order_logs")
        .select("status").eq("order_id", orderId).maybeSingle();
      if (latestError || !latestLog) return "error";
      if (latestLog.status === "fulfilled") return "fulfilled";
      if (latestLog.status === "refunded") return "refunded";
      if (latestLog.status !== "refund_review") return "error";
    }

    const { error: reviewError } = await supabase.from("payment_refund_reviews").insert({
      gateway_payment_id: paymentId,
      gateway_order_id: orderId,
      user_id: orderLog.user_id,
      reason,
    });
    return reviewError && reviewError.code !== "23505" ? "error" : "recorded";
  };

  const requestAutomaticRefund = async (
    reason: string,
  ): Promise<"recorded" | "fulfilled" | "refunded" | "error"> => {
    const reviewResult = await recordRefundReview(reason);
    if (reviewResult !== "recorded") return reviewResult;

    const { data: existingReview, error: existingReviewError } = await supabase.from("payment_refund_reviews")
      .select("refund_id,status")
      .eq("gateway_payment_id", paymentId)
      .maybeSingle();
    if (existingReviewError) return "error";
    if (existingReview?.status === "resolved") return "refunded";
    if (existingReview?.refund_id) return "recorded";

    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keyId || !keySecret) {
      const { error } = await supabase.from("payment_refund_reviews")
        .update({ reason: `${reason} Automatic refund is unavailable. Issue the refund in Razorpay and record its ID here.` })
        .eq("gateway_payment_id", paymentId)
        .eq("status", "pending");
      return error ? "error" : "recorded";
    }

    let refundResponse: Response;
    try {
      refundResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId as string)}/refund`, {
        method: "POST",
        headers: {
          authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
          "content-type": "application/json",
          "X-Refund-Idempotency": `healthoraa-${paymentId}`,
        },
        body: JSON.stringify({ notes: { reason: "Reservation expired before payment capture" } }),
      });
    } catch {
      return "error";
    }

    if (!refundResponse.ok) {
      if ([408, 409, 425, 429].includes(refundResponse.status) || refundResponse.status >= 500) {
        // A non-2xx webhook response makes Razorpay retry with exponential backoff. The refund
        // idempotency key makes a retry safe if the provider accepted a request before timing out.
        return "error";
      }
      const { error } = await supabase.from("payment_refund_reviews")
        .update({ reason: `${reason} Automatic refund could not be started. Issue the refund in Razorpay and record its ID here.` })
        .eq("gateway_payment_id", paymentId)
        .eq("status", "pending");
      return error ? "error" : "recorded";
    }

    let refundResult: unknown;
    try {
      refundResult = await refundResponse.json();
    } catch {
      return "error";
    }
    const refundId = isObject(refundResult) && typeof refundResult.id === "string" ? refundResult.id : null;
    const refundStatus = isObject(refundResult) && typeof refundResult.status === "string" ? refundResult.status : null;
    if (!refundId) return "error";

    if (refundStatus === "failed") {
      const { error } = await supabase.from("payment_refund_reviews")
        .update({
          refund_id: null,
          reason: `${reason} Automatic refund failed. Issue the refund in Razorpay and record its ID here.`,
        })
        .eq("gateway_payment_id", paymentId)
        .eq("status", "pending");
      return error ? "error" : "recorded";
    }

    const { error: refundIdError } = await supabase.from("payment_refund_reviews")
      .update({ refund_id: refundId })
      .eq("gateway_payment_id", paymentId)
      .eq("status", "pending");
    if (refundIdError) return "error";

    if (refundStatus === "processed") {
      const resolvedAt = new Date().toISOString();
      const { error: transactionUpdateError } = await supabase.from("payment_transactions")
        .update({ status: "refunded" })
        .eq("gateway_payment_id", paymentId);
      if (transactionUpdateError) return "error";
      const { error: reviewUpdateError } = await supabase.from("payment_refund_reviews")
        .update({ status: "resolved", resolved_at: resolvedAt })
        .eq("gateway_payment_id", paymentId)
        .eq("refund_id", refundId)
        .eq("status", "pending");
      if (reviewUpdateError) return "error";
      const { error: orderUpdateError } = await supabase.from("razorpay_order_logs")
        .update({ status: "refunded" })
        .eq("order_id", orderId)
        .eq("status", "refund_review");
      if (orderUpdateError) return "error";
      return "refunded";
    }

    return "recorded";
  };

  if (orderLog.status === "fulfilled") {
    return jsonResponse({ received: true, status: "captured", duplicate: true, entity_type: orderLog.entity_type });
  }

  if (captured && !paymentOrderUsable) {
    const review = await requestAutomaticRefund(
      "Razorpay captured this payment after its local payment order was superseded or failed.",
    );
    if (review === "error") {
      return jsonResponse({ error: "Captured payment refund review could not be recorded" }, 500);
    }
    return jsonResponse({
      received: true,
      status: review === "refunded" ? "refunded" : "captured",
      refund_review: review === "recorded",
      duplicate: review === "fulfilled" || review === "refunded",
    });
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
      const { data: booking, error: bookingError } = await supabase
        .from("consultations")
        .select("booking_status")
        .eq("id", orderLog.entity_id)
        .maybeSingle();
      if (bookingError) return jsonResponse({ error: "Could not verify consultation state before refunding." }, 500);
      if (booking?.booking_status !== "confirmed") {
        const review = await requestAutomaticRefund(
          "The consultation was no longer awaiting payment when Razorpay captured this payment.",
        );
        if (review === "error") {
          return jsonResponse({ error: "Captured payment refund review could not be recorded" }, 500);
        }
        return jsonResponse({
          received: true,
          status: review === "refunded" ? "refunded" : status,
          entity_type: orderLog.entity_type,
          refund_review: review === "recorded",
          duplicate: review === "fulfilled" || review === "refunded",
        });
      }
    }
  } else if (orderLog.entity_type === "shop_order") {
    const { data: paidOrder, error } = await supabase.from("orders").update({ status: "paid" })
      .eq("id", orderLog.entity_id).eq("customer_id", orderLog.user_id).eq(
        "status",
        "pending",
      ).is("stock_released_at", null).gt("reservation_expires_at", new Date().toISOString())
      .select("id").maybeSingle();
    if (error) {
      return jsonResponse({
        error: "Payment saved, but order confirmation failed",
      }, 500);
    }
    if (!paidOrder) {
      const { data: currentOrder, error: currentOrderError } = await supabase.from("orders")
        .select("status").eq("id", orderLog.entity_id).eq("customer_id", orderLog.user_id).maybeSingle();
      if (currentOrderError) return jsonResponse({ error: "Payment saved, but order state could not be checked." }, 500);
      if (currentOrder?.status === "paid" || currentOrder?.status === "shipped" || currentOrder?.status === "delivered") {
        // A concurrent webhook already applied this captured payment.
      } else {
        const review = await requestAutomaticRefund(
          "The stock reservation expired before Razorpay captured this payment.",
        );
        if (review === "error") {
          return jsonResponse({ error: "Captured payment refund review could not be recorded" }, 500);
        }
        return jsonResponse({
          received: true,
          status: review === "refunded" ? "refunded" : status,
          refund_review: review === "recorded",
          duplicate: review === "fulfilled" || review === "refunded",
        });
      }
    }
  } else if (orderLog.entity_type === "program") {
    const { error: enrolmentError } = await supabase.rpc("fulfill_program_enrolment", {
      p_patient_id: orderLog.user_id,
      p_program_id: orderLog.entity_id,
      p_order_id: orderId,
    });
    if (enrolmentError) {
      return jsonResponse({ error: "Payment saved, but enrolment could not be activated." }, 500);
    }
  } else {
    return jsonResponse({ error: "Unsupported payment entity type" }, 400);
  }

  const { error: fulfillmentLogError } = await supabase.from("razorpay_order_logs")
    .update({ status: "fulfilled" })
    .eq("order_id", orderId)
    .in("status", ["captured", "fulfilled"]);
  if (fulfillmentLogError) return jsonResponse({ error: "Payment succeeded, but its final state could not be recorded" }, 500);

  return jsonResponse({
    received: true,
    status,
    entity_type: orderLog.entity_type,
  });
});
