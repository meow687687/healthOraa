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
    const refundId = refund.id as string;
    const refundStatus = eventName === "refund.processed"
      ? "processed"
      : eventName === "refund.failed"
      ? "failed"
      : "created";
    const { data: recorded, error: recordError } = await supabase.rpc("record_razorpay_refund_event", {
      p_refund_id: refundId,
      p_gateway_payment_id: paymentId,
      p_gateway_order_id: typeof orderId === "string" ? orderId : null,
      p_amount_paise: refund.amount,
      p_status: refundStatus,
    });
    if (recordError || recorded !== true) return jsonResponse({ error: "Could not retain refund event" }, 500);

    const { data: reconciledStatus, error: reconciliationError } = await supabase.rpc(
      "reconcile_razorpay_refunds",
      { p_gateway_payment_id: paymentId },
    );
    if (reconciliationError) return jsonResponse({ error: "Could not reconcile refund events" }, 500);
    const responseStatus = reconciledStatus === "partial_review"
      ? "partial_refund_review"
      : reconciledStatus;
    return jsonResponse({ received: true, status: responseStatus });
  }

  const { data: orderLog, error: lookupError } = await supabase
    .from("razorpay_order_logs")
    .select(
      "order_id,user_id,amount_paise,currency,status,entity_type,entity_id,captured_payment_id",
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
  if (orderLog.status === "refunded" && captured && orderLog.captured_payment_id === paymentId) {
    return jsonResponse({
      received: true,
      status: "refunded",
      duplicate: true,
      entity_type: orderLog.entity_type,
    });
  }
  if (orderLog.status === "refunded" && !captured) {
    return jsonResponse({
      received: true,
      status: "refunded",
      duplicate: true,
      entity_type: orderLog.entity_type,
    });
  }

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
  const status = priorPayment?.status === "refunded"
    ? "refunded"
    : captured || alreadyCaptured
    ? "captured"
    : "failed";
  let duplicateCapturedPayment = captured && (
    Boolean(orderLog.captured_payment_id && orderLog.captured_payment_id !== paymentId) ||
    (orderLog.status === "refunded" && orderLog.captured_payment_id !== paymentId)
  );
  if (captured && paymentOrderUsable) {
    const { data: claimed, error: claimError } = await supabase.rpc("claim_razorpay_order_capture", {
      p_order_id: orderId,
      p_payment_id: paymentId,
    });
    if (claimError) return jsonResponse({ error: "Could not claim captured payment" }, 500);
    if (claimed !== true) {
      const { data: latestLog, error: latestError } = await supabase.from("razorpay_order_logs")
        .select("status,captured_payment_id").eq("order_id", orderId).maybeSingle();
      if (latestError || !latestLog) return jsonResponse({ error: "Could not recheck captured payment" }, 500);
      orderLog.status = latestLog.status;
      orderLog.captured_payment_id = latestLog.captured_payment_id;
      duplicateCapturedPayment = Boolean(latestLog.captured_payment_id && latestLog.captured_payment_id !== paymentId);
      paymentOrderUsable = false;
    } else if (orderLog.status === "created") {
      orderLog.status = "captured";
      orderLog.captured_payment_id = paymentId;
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

  let refundReconciliation: string | null = null;
  if (status === "captured") {
    const { data: result, error: reconciliationError } = await supabase.rpc(
      "reconcile_razorpay_refunds",
      { p_gateway_payment_id: paymentId },
    );
    if (reconciliationError) return jsonResponse({ error: "Could not reconcile prior refund events" }, 500);
    refundReconciliation = typeof result === "string" ? result : "none";
  }

  const recordRefundReview = async (
    reason: string,
    preserveFulfilledOrder = false,
  ): Promise<"recorded" | "fulfilled" | "refunded" | "error"> => {
    if (preserveFulfilledOrder) {
      const { data: latestLog, error: latestError } = await supabase.from("razorpay_order_logs")
        .select("status").eq("order_id", orderId).maybeSingle();
      if (latestError || !latestLog) return "error";
    } else {
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
    preserveFulfilledOrder = false,
  ): Promise<"recorded" | "fulfilled" | "refunded" | "error"> => {
    const reviewResult = await recordRefundReview(reason, preserveFulfilledOrder);
    if (reviewResult !== "recorded") return reviewResult;

    const { data: existingReview, error: existingReviewError } = await supabase.from("payment_refund_reviews")
      .select("refund_id,status")
      .eq("gateway_payment_id", paymentId)
      .maybeSingle();
    if (existingReviewError) return "error";
    if (existingReview?.status === "resolved") return "refunded";

    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (existingReview?.refund_id) {
      if (!keyId || !keySecret) return "error";
      let statusResponse: Response;
      try {
        statusResponse = await fetch(`https://api.razorpay.com/v1/refunds/${encodeURIComponent(existingReview.refund_id)}`, {
          headers: { authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}` },
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        return "error";
      }
      if (!statusResponse.ok) return "error";
      let savedRefund: unknown;
      try {
        savedRefund = await statusResponse.json();
      } catch {
        return "error";
      }
      if (!isObject(savedRefund) || savedRefund.id !== existingReview.refund_id || savedRefund.payment_id !== paymentId ||
          !Number.isSafeInteger(savedRefund.amount) || (savedRefund.amount as number) <= 0) return "error";
      const savedStatus = savedRefund.status === "processed"
        ? "processed"
        : savedRefund.status === "failed"
        ? "failed"
        : "created";
      const { data: recorded, error: recordError } = await supabase.rpc("record_razorpay_refund_event", {
        p_refund_id: existingReview.refund_id,
        p_gateway_payment_id: paymentId,
        p_gateway_order_id: orderId,
        p_amount_paise: savedRefund.amount,
        p_status: savedStatus,
      });
      if (recordError || recorded !== true) return "error";
      const { data: reconciled, error: reconcileError } = await supabase.rpc("reconcile_razorpay_refunds", {
        p_gateway_payment_id: paymentId,
      });
      if (reconcileError) return "error";
      return reconciled === "refunded" ? "refunded" : "recorded";
    }

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
        signal: AbortSignal.timeout(10_000),
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
    const refundAmount = isObject(refundResult) && Number.isSafeInteger(refundResult.amount) && (refundResult.amount as number) > 0
      ? refundResult.amount
      : amount;
    if (!refundId || !Number.isSafeInteger(refundAmount) || (refundAmount as number) <= 0) return "error";

    const { error: refundIdError } = await supabase.from("payment_refund_reviews")
      .update({ refund_id: refundId })
      .eq("gateway_payment_id", paymentId)
      .eq("status", "pending");
    if (refundIdError) return "error";
    const gatewayRefundStatus = refundStatus === "processed"
      ? "processed"
      : refundStatus === "failed"
      ? "failed"
      : "created";
    const { data: recorded, error: recordError } = await supabase.rpc("record_razorpay_refund_event", {
      p_refund_id: refundId,
      p_gateway_payment_id: paymentId,
      p_gateway_order_id: orderId,
      p_amount_paise: refundAmount,
      p_status: gatewayRefundStatus,
    });
    if (recordError || recorded !== true) return "error";
    const { data: reconciled, error: reconcileError } = await supabase.rpc("reconcile_razorpay_refunds", {
      p_gateway_payment_id: paymentId,
    });
    if (reconcileError) return "error";
    return reconciled === "refunded" ? "refunded" : "recorded";
  };

  if (refundReconciliation && !["none", "unmatched"].includes(refundReconciliation)) {
    return jsonResponse({
      received: true,
      status: refundReconciliation === "refunded" ? "refunded" : "captured",
      entity_type: orderLog.entity_type,
      refund_review: refundReconciliation !== "refunded",
    });
  }

  if (status === "refunded") {
    return jsonResponse({ received: true, status: "refunded", duplicate: true, entity_type: orderLog.entity_type });
  }

  if (duplicateCapturedPayment) {
    const refund = await requestAutomaticRefund(
      "A second distinct payment was captured against an order that already has a captured payment. Refund the additional charge.",
      true,
    );
    if (refund === "error") return jsonResponse({ error: "Duplicate captured payment refund could not be reconciled" }, 500);
    return jsonResponse({
      received: true,
      status: refund === "refunded" ? "refunded" : "captured",
      entity_type: orderLog.entity_type,
      refund_review: refund === "recorded",
      duplicate: true,
    });
  }

  if (captured && orderLog.status === "refund_review" && orderLog.captured_payment_id === paymentId) {
    const { data: existingReview, error: reviewError } = await supabase.from("payment_refund_reviews")
      .select("refund_id,status")
      .eq("gateway_payment_id", paymentId)
      .maybeSingle();
    if (reviewError) return jsonResponse({ error: "Could not recheck existing refund review" }, 500);
    if (existingReview?.refund_id) {
      const resumedRefund = await requestAutomaticRefund(
        "Resume the previously recorded refund and reconcile its provider status.",
        true,
      );
      if (resumedRefund === "error") return jsonResponse({ error: "Existing refund could not be reconciled" }, 500);
      return jsonResponse({
        received: true,
        status: resumedRefund === "refunded" ? "refunded" : "captured",
        entity_type: orderLog.entity_type,
        refund_review: resumedRefund !== "refunded",
        duplicate: true,
      });
    }
    return jsonResponse({
      received: true,
      status: "captured",
      entity_type: orderLog.entity_type,
      refund_review: true,
      duplicate: true,
    });
  }

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
    const { data: confirmed, error } = await supabase.rpc("confirm_consultation_payment_capture", {
      p_consultation_id: orderLog.entity_id,
      p_patient_id: orderLog.user_id,
      p_order_id: orderId,
    });
    if (error) {
      return jsonResponse({
        error: "Payment saved, but consultation confirmation failed",
      }, 500);
    }
    if (!confirmed) {
      // An earlier delivery already confirmed it, or the booking was cancelled. A cancelled
      // booking is never confirmed here; its payment stays in the audit for a refund.
      const { data: booking, error: bookingError } = await supabase
        .from("consultations")
        .select("booking_status,payment_expires_at")
        .eq("id", orderLog.entity_id)
        .maybeSingle();
      if (bookingError) return jsonResponse({ error: "Could not verify consultation state before refunding." }, 500);
      if (booking?.booking_status !== "confirmed") {
        const expired = booking?.payment_expires_at !== null &&
          booking?.payment_expires_at !== undefined &&
          Date.parse(booking.payment_expires_at) <= Date.now();
        const review = await requestAutomaticRefund(
          expired
            ? "The consultation reservation expired before Razorpay captured this payment."
            : "The consultation was no longer awaiting payment when Razorpay captured this payment.",
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
    const { data: paidOrder, error } = await supabase.rpc("confirm_shop_order_payment_capture", {
      p_order_id: orderLog.entity_id,
      p_patient_id: orderLog.user_id,
    });
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
    const { data: enrolmentId, error: enrolmentError } = await supabase.rpc("fulfill_program_enrolment", {
      p_patient_id: orderLog.user_id,
      p_program_id: orderLog.entity_id,
      p_order_id: orderId,
    });
    if (enrolmentError) {
      return jsonResponse({ error: "Payment saved, but enrolment could not be activated." }, 500);
    }
    if (enrolmentId === null) {
      return jsonResponse({
        received: true,
        status: "captured",
        entity_type: orderLog.entity_type,
        refund_review: true,
      });
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
