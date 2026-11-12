// One editable availability window. `id` is a client key: the DB row id, or a generated UUID.
export interface WindowDraft {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface ScheduleSnapshot {
  rules: WindowDraft[];
  durationMinutes: number;
}

export interface ConsultationSlot {
  id: string;
  slotStart: string;
  slotEnd: string;
  status: "open" | "booked";
}

// What the Supabase queries return, before local draft and publish state is applied.
export interface ScheduleBase extends ScheduleSnapshot {
  slots: ConsultationSlot[];
}

export interface ScheduleView {
  draft: ScheduleSnapshot;
  published: ScheduleSnapshot;
  publishedSlots: ConsultationSlot[];
  publishedAt: string | null;
}
