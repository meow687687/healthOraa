import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { istWindow, makeSlots } from "../_shared/slots.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const authorization = request.headers.get("authorization");
  if (!serviceKey || !supabaseUrl) {
    return jsonResponse({ error: "Database is not configured" }, 500);
  }
  if (authorization !== `Bearer ${serviceKey}`) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
  const { data: practitioners, error: practitionerError } = await supabase.from(
    "practitioner_details",
  )
    .select("id,slot_duration_minutes").eq("is_active", true);
  if (practitionerError) {
    return jsonResponse({ error: "Could not load practitioners" }, 500);
  }
  if (!practitioners?.length) {
    return jsonResponse({ practitioners: [], total_created: 0 });
  }

  const ids = practitioners.map((practitioner) => practitioner.id);
  const { data: rules, error: rulesError } = await supabase.from(
    "practitioner_availability_rules",
  )
    .select("practitioner_id,day_of_week,start_time,end_time").eq(
      "is_active",
      true,
    ).in("practitioner_id", ids);
  if (rulesError) {
    return jsonResponse({ error: "Could not load availability" }, 500);
  }

  const now = new Date();
  const { start: startOfToday, end: endOfWindow } = istWindow(now);
  const { data: existingSlots, error: slotsError } = await supabase.from(
    "consultation_slots",
  )
    .select("practitioner_id,start_time")
    .in("practitioner_id", ids)
    .gte("start_time", startOfToday.toISOString())
    .lt("start_time", endOfWindow.toISOString());
  if (slotsError) {
    return jsonResponse({ error: "Could not check existing slots" }, 500);
  }

  const existing = new Set(
    (existingSlots ?? []).map((slot) =>
      `${slot.practitioner_id}:${new Date(slot.start_time).toISOString()}`
    ),
  );
  const slots = makeSlots(practitioners, rules ?? [], existing, now);
  for (let offset = 0; offset < slots.length; offset += 500) {
    const { error } = await supabase.from("consultation_slots").insert(
      slots.slice(offset, offset + 500),
    );
    if (error) {
      return jsonResponse(
        { error: "Could not create consultation slots" },
        500,
      );
    }
  }

  const totals = new Map(ids.map((id) => [id, 0]));
  for (const slot of slots) {
    totals.set(
      slot.practitioner_id,
      (totals.get(slot.practitioner_id) ?? 0) + 1,
    );
  }
  return jsonResponse({
    window_start: startOfToday.toISOString(),
    window_end: endOfWindow.toISOString(),
    total_created: slots.length,
    practitioners: practitioners.map((practitioner) => ({
      practitioner_id: practitioner.id,
      slots_created: totals.get(practitioner.id) ?? 0,
    })),
  });
});
