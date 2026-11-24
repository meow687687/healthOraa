import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Creates a Razorpay order for one of the patient's own pending items. The amount is read from the database,
// never from the request. The razorpay-webhook confirms the payment once Razorpay reports it captured.

const RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders";
const ENTITY_TYPES = ["consultation", "program", "shop_order"] as const;
type EntityType = (typeof ENTITY_TYPES)[number];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (body: Record<string, unknown>, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const bearerToken = (request: Request): string | null => {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;
};

// Returns the amount in paise for the item, or null when the patient may not pay for it now.
async function priceFor(
  // deno-lint-ignore no-explicit-any
  admin: any,
  entityType: EntityType,
  entityId: string,
  userId: string,
): Promise<{ amountPaise: number; error?: string; status?: number }> {
  if (entityType === "consultation") {
    const { data, error } = await admin.from("consultations")
      .select("id, patient_id, booking_status, amount_inr, payment_expires_at")
      .eq("id", entityId).maybeSingle();
    if (error) return { amountPaise: 0, error: "Could not load the booking.", status: 500 };
    if (!data || data.patient_id !== userId) return { amountPaise: 0, error: "Booking not found.", status: 404 };
    if (data.booking_status !== "pending_payment") {
      return { amountPaise: 0, error: "This booking is not waiting for payment.", status: 409 };
    }
    if (!data.payment_expires_at || Date.parse(data.payment_expires_at) <= Date.now()) {
      return { amountPaise: 0, error: "This booking expired. Choose another consultation slot.", status: 409 };
    }
    return { amountPaise: Math.round(Number(data.amount_inr) * 100) };
  }

  if (entityType === "program") {
    const { data, error } = await admin.from("programs")
      .select("id, price_inr, is_active").eq("id", entityId).maybeSingle();
    if (error) return { amountPaise: 0, error: "Could not load the programme.", status: 500 };
    if (!data || !data.is_active) return { amountPaise: 0, error: "Programme not available.", status: 404 };
    const { data: active, error: activeError } = await admin.from("program_enrolments")
      .select("id").eq("patient_id", userId).eq("program_id", entityId).eq("status", "active")
      .gt("expires_at", new Date().toISOString()).limit(1).maybeSingle();
    if (activeError) return { amountPaise: 0, error: "Could not check your enrolments.", status: 500 };
    if (active) return { amountPaise: 0, error: "You already have an active enrolment in this programme.", status: 409 };
    return { amountPaise: Math.round(Number(data.price_inr) * 100) };
  }

  const { data, error } = await admin.from("orders")
    .select("id, customer_id, total_amount_inr, status, reservation_expires_at, stock_released_at")
    .eq("id", entityId).maybeSingle();
  if (error) return { amountPaise: 0, error: "Could not load the order.", status: 500 };
  if (!data || data.customer_id !== userId) return { amountPaise: 0, error: "Order not found.", status: 404 };
  if (data.status !== "pending") return { amountPaise: 0, error: "This order is not waiting for payment.", status: 409 };
  if (data.stock_released_at !== null || !data.reservation_expires_at ||
      Date.parse(data.reservation_expires_at) <= Date.now()) {
    return { amountPaise: 0, error: "This order's stock reservation has expired. Place a new order.", status: 409 };
  }
  return { amountPaise: Math.round(Number(data.total_amount_inr) * 100) };
}

function orderResponse(orderId: string, amountPaise: number, keyId: string): Response {
  return json({ order_id: orderId, amount_paise: amountPaise, currency: "INR", key_id: keyId }, 200);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const token = bearerToken(request);
  if (!token) return json({ error: "Sign in to pay." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "The server is not configured." }, 500);

  const caller = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await caller.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "Sign in again to pay." }, 401);
  const userId = userData.user.id;

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("role, deleted_at").eq("id", userId).maybeSingle();
  if (profileError || !profile) return json({ error: "We could not load your account." }, 500);
  if (profile.deleted_at !== null || profile.role !== "patient") {
    return json({ error: "This account cannot make payments." }, 403);
  }
  // Live payment creation is opt-in on the server; a client build flag alone can never enable charges.
  if (Deno.env.get("RAZORPAY_PAYMENTS_ENABLED") !== "true") {
    return json({ error: "Payments are disabled for this environment." }, 503);
  }
  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) {
    return json({ error: "Payments are not configured on this server yet." }, 503);
  }

  let body: { entity_type?: unknown; entity_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Send the item to pay for as JSON." }, 400);
  }
  const entityType = body.entity_type;
  const entityId = body.entity_id;
  if (typeof entityType !== "string" || !ENTITY_TYPES.includes(entityType as EntityType)) {
    return json({ error: "Unknown payment type." }, 400);
  }
  if (typeof entityId !== "string" || !UUID.test(entityId)) {
    return json({ error: "Unknown item." }, 400);
  }

  if (entityType === "shop_order" || entityType === "consultation") {
    const expiryFunction = entityType === "shop_order" ? "expire_pending_shop_orders" : "expire_pending_consultations";
    const { error: expiryError } = await admin.rpc(expiryFunction, { p_limit: 500 });
    if (expiryError) return json({ error: "Pending reservations could not be refreshed. Try again." }, 500);
  }
  const priced = await priceFor(admin, entityType as EntityType, entityId, userId);
  if (priced.error) return json({ error: priced.error }, priced.status ?? 400);
  if (priced.amountPaise <= 0) return json({ error: "This item has no amount to pay." }, 409);

  const { data: refundReview, error: refundReviewError } = await admin.from("razorpay_order_logs")
    .select("order_id")
    .eq("user_id", userId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("status", "refund_review")
    .limit(1)
    .maybeSingle();
  if (refundReviewError) return json({ error: "Could not check the previous payment status." }, 500);
  if (refundReview) {
    return json({ error: "A previous payment needs refund review before another payment can start." }, 409);
  }

  const { data: priorOrder, error: priorError } = await admin.from("razorpay_order_logs")
    .select("order_id, amount_paise, status")
    .eq("user_id", userId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .in("status", ["created", "captured"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (priorError) return json({ error: "Could not check for an existing payment." }, 500);
  if (priorOrder && !priorOrder.order_id.startsWith("order_mock_")) {
    if (priorOrder.status === "captured") {
      return json({ error: "Payment is processing. Refresh the booking or order before trying again." }, 409);
    }
    if (priorOrder.amount_paise === priced.amountPaise) {
      if (entityType === "consultation") {
        const { data: linked, error: linkError } = await admin.from("consultations")
          .update({ payment_order_id: priorOrder.order_id })
          .eq("id", entityId).eq("patient_id", userId).eq("booking_status", "pending_payment")
          .select("id").maybeSingle();
        if (linkError || !linked) return json({ error: "The booking expired before payment could start." }, linkError ? 500 : 409);
      }
      return orderResponse(priorOrder.order_id, priced.amountPaise, keyId);
    }
    return json({ error: "An existing payment order has a different amount. Contact support before retrying." }, 409);
  }

  const auth = btoa(`${keyId}:${keySecret}`);
  const response = await fetch(RAZORPAY_ORDERS_URL, {
    method: "POST",
    headers: { authorization: `Basic ${auth}`, "content-type": "application/json" },
    body: JSON.stringify({
      amount: priced.amountPaise,
      currency: "INR",
      receipt: `hx_${crypto.randomUUID().replaceAll("-", "").slice(0, 32)}`,
      notes: { entity_type: entityType, entity_id: entityId },
    }),
  });
  if (!response.ok) return json({ error: "Razorpay could not create the payment. Try again." }, 502);
  const order = (await response.json()) as { id?: unknown };
  if (typeof order.id !== "string") return json({ error: "Razorpay returned no order." }, 502);

  // The entity may expire while Razorpay is creating the order. Never expose a payment order if the
  // booking or inventory reservation is no longer valid by the time the gateway responds.
  const stillPayable = await priceFor(admin, entityType as EntityType, entityId, userId);
  if (stillPayable.error || stillPayable.amountPaise !== priced.amountPaise) {
    return json({ error: stillPayable.error ?? "The price changed. Refresh and try again." }, stillPayable.status ?? 409);
  }

  const { error: logError } = await admin.from("razorpay_order_logs").insert({
    order_id: order.id,
    user_id: userId,
    amount_paise: priced.amountPaise,
    currency: "INR",
    status: "created",
    entity_type: entityType,
    entity_id: entityId,
  });
  if (logError) {
    // Concurrent retries may both reach Razorpay, but the database admits only one active order per entity.
    // Return the winner; the unrecorded Razorpay order is never exposed to the client.
    const { data: winner } = await admin.from("razorpay_order_logs")
      .select("order_id, amount_paise, status")
      .eq("user_id", userId).eq("entity_type", entityType).eq("entity_id", entityId)
      .in("status", ["created", "captured"]).limit(1).maybeSingle();
    if (winner && winner.amount_paise === priced.amountPaise) {
      if (winner.status === "captured") {
        return json({ error: "Payment is processing. Refresh the booking or order before trying again." }, 409);
      }
      if (entityType === "consultation") {
        const { data: linked, error: linkError } = await admin.from("consultations")
          .update({ payment_order_id: winner.order_id })
          .eq("id", entityId).eq("patient_id", userId).eq("booking_status", "pending_payment")
          .select("id").maybeSingle();
        if (linkError || !linked) return json({ error: "The booking expired before payment could start." }, linkError ? 500 : 409);
      }
      return orderResponse(winner.order_id, priced.amountPaise, keyId);
    }
    return json({ error: "The payment could not be recorded. Try again." }, 500);
  }

  if (entityType === "consultation") {
    // The webhook checks the entity's pending state and the recorded payment order before confirming.
    const { data: linked, error: linkError } = await admin.from("consultations")
      .update({ payment_order_id: order.id })
      .eq("id", entityId).eq("patient_id", userId).eq("booking_status", "pending_payment")
      .select("id").maybeSingle();
    if (linkError || !linked) {
      await admin.from("razorpay_order_logs").update({ status: "superseded" }).eq("order_id", order.id);
      return json({ error: "The booking expired before payment could start." }, linkError ? 500 : 409);
    }
  } else if (entityType === "shop_order") {
    const { data: liveOrder, error: liveError } = await admin.from("orders")
      .select("id").eq("id", entityId).eq("customer_id", userId).eq("status", "pending")
      .is("stock_released_at", null).gt("reservation_expires_at", new Date().toISOString()).maybeSingle();
    if (liveError || !liveOrder) {
      await admin.from("razorpay_order_logs").update({ status: "superseded" }).eq("order_id", order.id);
      return json({ error: "The stock reservation expired before payment could start." }, liveError ? 500 : 409);
    }
  }

  // A refund review can be recorded while the gateway order is being created. Recheck before
  // exposing the order ID so the client cannot start another payment in that race window.
  const { data: lateRefundReview, error: lateRefundReviewError } = await admin.from("razorpay_order_logs")
    .select("order_id")
    .eq("user_id", userId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("status", "refund_review")
    .limit(1)
    .maybeSingle();
  if (lateRefundReviewError || lateRefundReview) {
    const { error: supersedeError } = await admin.from("razorpay_order_logs")
      .update({ status: "superseded" }).eq("order_id", order.id).eq("status", "created");
    if (supersedeError) return json({ error: "The new payment order could not be marked inactive." }, 500);
    return json({
      error: lateRefundReviewError
        ? "The previous payment status could not be confirmed. Try again."
        : "A previous payment needs refund review before another payment can start.",
    }, lateRefundReviewError ? 500 : 409);
  }

  return orderResponse(order.id, priced.amountPaise, keyId);
});
