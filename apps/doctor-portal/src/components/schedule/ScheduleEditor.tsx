import { useState } from "react";
import { Eye, Save, Send } from "lucide-react";
import { availabilityWindowSchema, SLOT_DURATION_OPTIONS } from "@healthoraa/validation";
import { Badge, ERROR_BOX, PANEL, cn, useToast } from "@healthoraa/ui";
import { conflictingRuleIds, snapshotsEqual } from "../../lib/scheduleGenerator";
import { formatDate } from "../../lib/prescriptionOptions";
import { useSaveScheduleDraft, usePublishSlots } from "../../hooks/useDoctorSchedule";
import type { ScheduleSnapshot, ScheduleView, WindowDraft } from "../../types/schedule";
import { DayCard } from "./DayCard";
import { WeekGrid, slotsForDay } from "./WeekGrid";
import { SlotPreviewDrawer } from "./SlotPreviewDrawer";

const PILL_OUTLINE =
  "inline-flex items-center gap-2 rounded-full border border-aura-line bg-aura-s2 px-4 py-2 text-xs font-semibold text-text-secondary transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40";
const PILL_PRIMARY =
  "inline-flex items-center gap-2 rounded-full bg-accent-blue px-4 py-2 text-xs font-semibold text-white shadow-aura-elevated transition-all hover:bg-accent-blue/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";

// Working copy of the schedule. Edits stay here until saved as a draft or published.
export function ScheduleEditor({ view }: { view: ScheduleView }) {
  const [rules, setRules] = useState<WindowDraft[]>(() => view.draft.rules);
  const [durationMinutes, setDurationMinutes] = useState(view.draft.durationMinutes);
  const [previewOpen, setPreviewOpen] = useState(false);
  // Monday first. The day inspector edits this day; the week grid shows all seven.
  const [selectedDay, setSelectedDay] = useState(1);
  const toast = useToast();
  const save = useSaveScheduleDraft();
  const publish = usePublishSlots();

  const snapshot: ScheduleSnapshot = { rules, durationMinutes };
  const conflicts = conflictingRuleIds(rules);

  const errorFor = (rule: WindowDraft): string | null => {
    const parsed = availabilityWindowSchema.safeParse(rule);
    if (!parsed.success) return parsed.error.issues[0]?.message ?? "Check this window.";
    if (conflicts.has(rule.id)) return "Overlaps another window on this day.";
    return null;
  };
  const hasErrors = rules.some((rule) => errorFor(rule) !== null);

  const unsaved = !snapshotsEqual(snapshot, view.draft);
  const unpublished = !snapshotsEqual(view.draft, view.published);
  const statusLine = unsaved
    ? "Unsaved changes in this session"
    : unpublished
      ? "Draft saved. Patients still see the last published slots."
      : view.publishedAt
        ? `Published ${formatDate(new Date(view.publishedAt))}`
        : "Not yet published";

  const updateWindow = (id: string, patch: Partial<Omit<WindowDraft, "id" | "day_of_week">>) =>
    setRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));

  const toggleDay = (dayOfWeek: number, next: boolean) =>
    setRules((prev) => prev.map((rule) => (rule.day_of_week === dayOfWeek ? { ...rule, is_active: next } : rule)));

  const addWindow = (dayOfWeek: number) =>
    setRules((prev) => [
      ...prev,
      { id: crypto.randomUUID(), day_of_week: dayOfWeek, start_time: "19:00", end_time: "20:00", is_active: true },
    ]);

  const removeWindow = (id: string) => setRules((prev) => prev.filter((rule) => rule.id !== id));

  const onSaveDraft = () => {
    save.mutate(snapshot, { onSuccess: () => toast.success("Draft saved.") });
  };

  const onPublish = () => {
    publish.mutate(
      { snapshot },
      {
        onSuccess: (count) =>
          toast.success(`Slots published: ${count} for the upcoming week. Booked slots stay booked.`),
      },
    );
  };

  const actionError = save.error?.message ?? publish.error?.message ?? null;

  return (
    <div className="space-y-6">
      <section className={cn(PANEL, "space-y-4 lg:sticky lg:top-20 lg:z-10")}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-white">Weekly Schedule</h2>
            <p className="mt-0.5 text-xs text-text-secondary">{statusLine}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-full border border-aura-line2 bg-aura-s1 p-1" role="radiogroup" aria-label="Slot length">
              {SLOT_DURATION_OPTIONS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  role="radio"
                  aria-checked={durationMinutes === minutes}
                  onClick={() => setDurationMinutes(minutes)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                    durationMinutes === minutes ? "bg-aura-s3 text-text-primary shadow-aura-elevated" : "text-text-muted hover:text-text-primary",
                  )}
                >
                  {minutes} min
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setPreviewOpen(true)} className={PILL_OUTLINE}>
              <Eye className="h-3.5 w-3.5" />
              Slot Preview
            </button>
            <button
              type="button"
              onClick={onSaveDraft}
              disabled={hasErrors || !unsaved || save.isPending}
              className={PILL_OUTLINE}
            >
              <Save className="h-3.5 w-3.5" />
              Save draft
            </button>
            <button type="button" onClick={onPublish} disabled={hasErrors || publish.isPending} className={PILL_PRIMARY}>
              <Send className="h-3.5 w-3.5" />
              Publish Slots for Upcoming Week
            </button>
          </div>
        </div>

        {hasErrors && <p className="text-xs text-accent-amber">Fix the highlighted windows before saving or publishing.</p>}
        {actionError && <div className={ERROR_BOX}>{actionError}</div>}
        {!hasErrors && unsaved && <Badge tone="amber">Unsaved changes</Badge>}
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <WeekGrid rules={rules} durationMinutes={durationMinutes} selectedDay={selectedDay} onSelect={setSelectedDay} />
        <DayCard
          dayOfWeek={selectedDay}
          windows={rules.filter((rule) => rule.day_of_week === selectedDay)}
          durationMinutes={durationMinutes}
          slotCount={slotsForDay(rules, selectedDay, durationMinutes)}
          errorFor={errorFor}
          onToggleDay={(next) => toggleDay(selectedDay, next)}
          onAddWindow={() => addWindow(selectedDay)}
          onUpdate={updateWindow}
          onRemove={removeWindow}
        />
      </div>

      <SlotPreviewDrawer
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        slots={view.publishedSlots}
        publishedAt={view.publishedAt}
      />
    </div>
  );
}

