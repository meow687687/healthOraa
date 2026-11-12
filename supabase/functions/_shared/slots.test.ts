import { makeSlots } from "./slots.ts";

Deno.test("weekly slots use IST, fit interval duration, and skip existing starts", () => {
  const now = new Date("2026-03-01T00:00:00.000Z");
  const practitioners = [{ id: "practitioner-1", slot_duration_minutes: 30 }];
  const rules = [{
    practitioner_id: "practitioner-1",
    day_of_week: 0,
    start_time: "10:00:00",
    end_time: "11:00:00",
  }];
  const slots = makeSlots(practitioners, rules, new Set(), now);
  if (slots.length !== 4) {
    throw new Error(`expected 4 slots, received ${slots.length}`);
  }
  if (slots[0].start_time !== "2026-03-01T04:30:00.000Z") {
    throw new Error("slot was not converted from IST");
  }
  const existing = new Set([`practitioner-1:${slots[0].start_time}`]);
  if (makeSlots(practitioners, rules, existing, now).length !== 3) {
    throw new Error("existing slot was not skipped");
  }
});
