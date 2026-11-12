import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;

type AvailabilityRule = {
  practitioner_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};
type Practitioner = { id: string; slot_duration_minutes: number };
type Slot = { practitioner_id: string; start_time: string; end_time: string; is_booked: false };

function istDateParts(now: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)])) as {
    year: number; month: number; day: number;
  };
}

function timeInIst(date: Date, time: string): Date {
  const [hours, minutes, seconds = 0] = time.split(":").map(Number);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hours, minutes, seconds) - IST_OFFSET_MS);
}

function makeSlots(
  practitioners: Practitioner[],
  rules: AvailabilityRule[],
  existing: Set<string>,
  now: Date,
): Slot[] {
  const durations = new Map(practitioners.map((practitioner) => [practitioner.id, practitioner.slot_duration_minutes]));
  const firstDay = istDateParts(now);
  const firstDate = new Date(Date.UTC(firstDay.year, firstDay.month - 1, firstDay.day));
  const generated = new Map<string, Slot>();

  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const date = new Date(firstDate.getTime() + dayOffset * DAY_MS);
    const weekday = date.getUTCDay();
    for (const rule of rules) {
      if (rule.day_of_week !== weekday) continue;
      const duration = durations.get(rule.practitioner_id);
      if (!duration || duration <= 0) continue;
      const rangeStart = timeInIst(date, rule.start_time);
      const rangeEnd = timeInIst(date, rule.end_time);
      for (let start = rangeStart; start.getTime() + duration * 60_000 <= rangeEnd.getTime(); start = new Date(start.getTime() + duration * 60_000)) {
        if (start <= now) continue;
        const startTime = start.toISOString();
        const key = `${rule.practitioner_id}:${startTime}`;
        if (existing.has(key) || generated.has(key)) continue;
        generated.set(key, {
          practitioner_id: rule.practitioner_id,
          start_time: startTime,
          end_time: new Date(start.getTime() + duration * 60_000).toISOString(),
          is_booked: false,
        });
      }
    }
  }
  return [...generated.values()];
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const authorization = request.headers.get("authorization");
  if (!serviceKey || !supabaseUrl) return jsonResponse({ error: "Database is not configured" }, 500);
  if (authorization !== `Bearer ${serviceKey}`) return jsonResponse({ error: "Unauthorized" }, 401);

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: practitioners, error: practitionerError } = await supabase.from("practitioner_details")
    .select("id,slot_duration_minutes").eq("is_active", true);
  if (practitionerError) return jsonResponse({ error: "Could not load practitioners" }, 500);
  if (!practitioners?.length) return jsonResponse({ practitioners: [], total_created: 0 });

  const ids = practitioners.map((practitioner) => practitioner.id);
  const { data: rules, error: rulesError } = await supabase.from("practitioner_availability_rules")
    .select("practitioner_id,day_of_week,start_time,end_time").eq("is_active", true).in("practitioner_id", ids);
  if (rulesError) return jsonResponse({ error: "Could not load availability" }, 500);

  const now = new Date();
  const today = istDateParts(now);
  const startOfToday = new Date(Date.UTC(today.year, today.month - 1, today.day) - IST_OFFSET_MS);
  const endOfWindow = new Date(startOfToday.getTime() + 14 * DAY_MS);
  const { data: existingSlots, error: slotsError } = await supabase.from("consultation_slots")
    .select("practitioner_id,start_time")
    .in("practitioner_id", ids)
    .gte("start_time", startOfToday.toISOString())
    .lt("start_time", endOfWindow.toISOString());
  if (slotsError) return jsonResponse({ error: "Could not check existing slots" }, 500);

  const existing = new Set((existingSlots ?? []).map((slot) => `${slot.practitioner_id}:${new Date(slot.start_time).toISOString()}`));
  const slots = makeSlots(practitioners, rules ?? [], existing, now);
  for (let offset = 0; offset < slots.length; offset += 500) {
    const { error } = await supabase.from("consultation_slots").insert(slots.slice(offset, offset + 500));
    if (error) return jsonResponse({ error: "Could not create consultation slots" }, 500);
  }

  const totals = new Map(ids.map((id) => [id, 0]));
  for (const slot of slots) totals.set(slot.practitioner_id, (totals.get(slot.practitioner_id) ?? 0) + 1);
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

Deno.test("weekly slot generation applies IST dates, duration, and duplicate skipping", () => {
  const now = new Date("2026-03-01T00:00:00.000Z");
  const practitioners = [{ id: "practitioner-1", slot_duration_minutes: 30 }];
  const rules = [{
    practitioner_id: "practitioner-1", day_of_week: 0,
    start_time: "10:00:00", end_time: "11:00:00",
  }];
  const slots = makeSlots(practitioners, rules, new Set(), now);
  if (slots.length !== 2) throw new Error(`expected 2 slots, received ${slots.length}`);
  if (slots[0].start_time !== "2026-03-01T04:30:00.000Z") throw new Error("slot was not converted from IST");
  const existing = new Set([`practitioner-1:${slots[0].start_time}`]);
  if (makeSlots(practitioners, rules, existing, now).length !== 1) throw new Error("existing slot was not skipped");
});
