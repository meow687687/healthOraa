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
      .select("id, patient_id, booking_status, amount_inr")
      .eq("id", entityId).maybeSingle();
    if (error) return { amountPaise: 0, error: "Could not load the booking.", status: 500 };
    if (!data || data.patient_id !== userId) return { amountPaise: 0, error: "Booking not found.", status: 404 };
    if (data.booking_status !== "pending_payment") {
      return { amountPaise: 0, error: "This booking is not waiting for payment.", status: 409 };
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
    .select("id, customer_id, total_amount_inr, status").eq("id", entityId).maybeSingle();
  if (error) return { amountPaise: 0, error: "Could not load the order.", status: 500 };
  if (!data || data.customer_id !== userId) return { amountPaise: 0, error: "Order not found.", status: 404 };
  if (data.status !== "pending") return { amountPaise: 0, error: "This order is not waiting for payment.", status: 409 };
  return { amountPaise: Math.round(Number(data.total_amount_inr) * 100) };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const token = bearerToken(request);
  if (!token) return json({ error: "Sign in to pay." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
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
  // Checked after the account, so a deleted account is refused before any configuration detail is revealed.
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

  const priced = await priceFor(admin, entityType as EntityType, entityId, userId);
  if (priced.error) return json({ error: priced.error }, priced.status ?? 400);
  if (priced.amountPaise <= 0) return json({ error: "This item has no amount to pay." }, 409);

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

  const { error: logError } = await admin.from("razorpay_order_logs").insert({
    order_id: order.id,
    user_id: userId,
    amount_paise: priced.amountPaise,
    currency: "INR",
    status: "created",
    entity_type: entityType,
    entity_id: entityId,
  });
  if (logError) return json({ error: "The payment could not be recorded. Try again." }, 500);

  if (entityType === "consultation") {
    // The webhook matches a consultation by its payment_order_id, so point it at the new Razorpay order.
    const { error: linkError } = await admin.from("consultations")
      .update({ payment_order_id: order.id })
      .eq("id", entityId).eq("patient_id", userId).eq("booking_status", "pending_payment");
    if (linkError) return json({ error: "The booking could not be linked to the payment." }, 500);
  }

  return json({
    order_id: order.id,
    amount_paise: priced.amountPaise,
    currency: "INR",
    key_id: keyId,
  }, 200);
});
