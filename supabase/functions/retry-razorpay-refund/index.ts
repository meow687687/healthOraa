import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { automaticRefundRequest } from "../_shared/razorpay.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const PAYMENT_ID = /^[A-Za-z0-9_-]{1,128}$/;

type JsonObject = Record<string, unknown>;
type RefundReview = {
  gateway_payment_id: string;
  gateway_order_id: string;
  refund_id: string | null;
  status: string;
  automatic_refund_state: string;
  reason: string;
};
type PaymentTransaction = {
  gateway_order_id: string | null;
  amount_inr: number;
  currency: string;
  status: string;
};
type RazorpayRefund = {
  id?: unknown;
  payment_id?: unknown;
  amount?: unknown;
  status?: unknown;
};

const json = (body: JsonObject, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "content-type": "application/json" } });

const bearerToken = (request: Request): string | null => {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const token = bearerToken(request);
  if (!token) return json({ error: "Sign in as an administrator to retry this refund." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "The server is not configured." }, 500);

  const caller = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await caller.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "Sign in again to retry this refund." }, 401);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("role, deleted_at").eq("id", userData.user.id).maybeSingle();
  if (profileError || !profile) return json({ error: "We could not load your account." }, 500);
  if (profile.deleted_at !== null || profile.role !== "admin") {
    return json({ error: "Only administrators can retry payment refunds." }, 403);
  }

  let body: { gateway_payment_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Send the gateway payment ID as JSON." }, 400);
  }
  const paymentId = body.gateway_payment_id;
  if (typeof paymentId !== "string" || !PAYMENT_ID.test(paymentId)) {
    return json({ error: "A valid gateway payment ID is required." }, 400);
  }

  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) return json({ error: "Razorpay refund recovery is not configured." }, 503);

  const { data: review, error: reviewError } = await admin.from("payment_refund_reviews")
    .select("gateway_payment_id, gateway_order_id, refund_id, status, automatic_refund_state, reason")
    .eq("gateway_payment_id", paymentId)
    .maybeSingle();
  if (reviewError) return json({ error: "Could not load the refund review." }, 500);
  if (!review) return json({ error: "Refund review not found." }, 404);
  const refundReview = review as RefundReview;
  if (refundReview.status === "resolved") return json({ status: "refunded", duplicate: true }, 200);
  const canStartRetry = refundReview.status === "pending" && refundReview.automatic_refund_state === "retryable";
  const canCheckExistingRefund = refundReview.status === "pending" &&
    refundReview.automatic_refund_state === "pending" && refundReview.refund_id !== null;
  if (!canStartRetry && !canCheckExistingRefund) {
    return json({ error: "This refund is no longer eligible for automatic retry." }, 409);
  }

  const { data: transaction, error: transactionError } = await admin.from("payment_transactions")
    .select("gateway_order_id, amount_inr, currency, status")
    .eq("gateway_payment_id", paymentId)
    .maybeSingle();
  if (transactionError) return json({ error: "Could not load the captured payment." }, 500);
  if (!transaction || transaction.gateway_order_id !== refundReview.gateway_order_id ||
      !["captured", "refund_review"].includes(transaction.status) || transaction.currency !== "INR") {
    return json({ error: "The captured payment no longer matches this refund review." }, 409);
  }

  const amountPaise = Math.round(Number(transaction.amount_inr) * 100);
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
    return json({ error: "The captured payment amount is invalid." }, 409);
  }

  const authorization = `Basic ${btoa(`${keyId}:${keySecret}`)}`;
  let refund: RazorpayRefund;
  let response: Response;
  try {
    response = refundReview.refund_id
      ? await fetch(`https://api.razorpay.com/v1/refunds/${encodeURIComponent(refundReview.refund_id)}`, {
        headers: { authorization },
        signal: AbortSignal.timeout(10_000),
      })
      : await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`, {
        ...automaticRefundRequest(paymentId, keyId, keySecret),
      });
  } catch {
    return json({ error: "Razorpay could not be reached. Retry this refund review." }, 502);
  }

  if (!response.ok) {
    if (![408, 409, 425, 429].includes(response.status) && response.status < 500) {
      let manualReviewUpdate = admin.from("payment_refund_reviews")
        .update({
          automatic_refund_state: "manual",
          reason: `${refundReview.reason} Razorpay could not complete automatic recovery. Verify the payment and refund in Razorpay, then continue with manual review.`,
        })
        .eq("gateway_payment_id", paymentId)
        .eq("status", "pending")
        .eq("automatic_refund_state", refundReview.automatic_refund_state);
      manualReviewUpdate = refundReview.refund_id
        ? manualReviewUpdate.eq("refund_id", refundReview.refund_id)
        : manualReviewUpdate.is("refund_id", null);
      const { data: updatedReview, error } = await manualReviewUpdate
        .select("gateway_payment_id")
        .maybeSingle();
      if (error) return json({ error: "Razorpay rejected the retry and the review could not be updated." }, 500);
      if (!updatedReview) return json({ error: "The refund review changed during recovery. Refresh and check its current state." }, 409);
      return json({ error: "Razorpay could not complete automatic recovery. Continue with manual review." }, 409);
    }
    return json({ error: "Razorpay has not confirmed the refund yet. Retry the review." }, 502);
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch {
    return json({ error: "Razorpay returned an unreadable refund response. Retry the review." }, 502);
  }
  if (typeof responseBody !== "object" || responseBody === null || Array.isArray(responseBody)) {
    return json({ error: "Razorpay returned an invalid refund response. Retry the review." }, 502);
  }
  refund = responseBody as RazorpayRefund;
  if (typeof refund.id !== "string" || refund.id.length === 0 || refund.payment_id !== paymentId ||
      !Number.isSafeInteger(refund.amount) || (refund.amount as number) <= 0 || (refund.amount as number) > amountPaise) {
    return json({ error: "Razorpay returned refund details that do not match the captured payment." }, 502);
  }

  const refundId = refund.id;
  const providerStatus = refund.status === "processed" ? "processed" : refund.status === "failed" ? "failed" : "created";
  const { error: saveError } = await admin.from("payment_refund_reviews")
    .update({ refund_id: refundId, automatic_refund_state: "pending" })
    .eq("gateway_payment_id", paymentId)
    .eq("status", "pending");
  if (saveError) return json({ error: "The Razorpay refund started but its status could not be saved. Retry safely." }, 500);

  const { data: reconciled, error: reconciliationError } = await admin.rpc("record_and_reconcile_razorpay_refund_event", {
    p_refund_id: refundId,
    p_gateway_payment_id: paymentId,
    p_gateway_order_id: refundReview.gateway_order_id,
    p_amount_paise: refund.amount,
    p_status: providerStatus,
  });
  if (reconciliationError || reconciled === "invalid") {
    return json({ error: "The refund started but its provider event could not be saved. Retry safely." }, 500);
  }
  return json({ status: reconciled === "refunded" ? "refunded" : "pending", refund_id: refundId }, 200);
});
