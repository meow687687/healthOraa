import { useState } from "react";
import { Badge, Drawer, DrawerHeader, INPUT, LABEL } from "@healthoraa/ui";
import type { ConsultationSlot } from "../../types/schedule";
import { formatIndiaDateTime, indiaDateKey } from "../../lib/indiaTime";
import { formatTime } from "../queue/consultationMeta";

// Shows the published slots for one date, with open and booked counts.
export function SlotPreviewDrawer({
  isOpen,
  onClose,
  slots,
  publishedAt,
}: {
  isOpen: boolean;
  onClose: () => void;
  slots: ConsultationSlot[];
  publishedAt: string | null;
}) {
  const todayKey = indiaDateKey(new Date());
  const [selected, setSelected] = useState(todayKey);
  const daySlots = slots.filter((slot) => indiaDateKey(slot.slotStart) === selected);
  const bookedCount = daySlots.filter((slot) => slot.status === "booked").length;
  const openCount = daySlots.length - bookedCount;

  return (
    <Drawer isOpen={isOpen} onClose={onClose} labelledBy="slot-preview-title" className="max-w-lg p-6 md:p-8">
      <DrawerHeader
        eyebrow={publishedAt ? `Published ${formatIndiaDateTime(publishedAt)}` : "Not yet published"}
        title="Slot Preview"
        titleId="slot-preview-title"
        onClose={onClose}
      />

      <div className="flex-1 space-y-5 py-6">
        <div className="space-y-1.5">
          <label htmlFor="slot-date" className={LABEL}>
            Date
          </label>
          <input
            id="slot-date"
            type="date"
            min={todayKey}
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            className={INPUT}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge tone="emerald">{openCount} open</Badge>
          <Badge tone="blue">{bookedCount} booked</Badge>
        </div>

        {daySlots.length === 0 ? (
          <p className="rounded-2xl border border-aura-line bg-aura-s2 px-4 py-6 text-center text-xs text-text-muted">
            No published slots on this date. Publish the upcoming week to open slots for patients.
          </p>
        ) : (
          <ol className="space-y-2" aria-label="Slots for the selected date">
            {daySlots.map((slot) => (
              <li
                key={slot.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-aura-line bg-aura-s2 px-4 py-3"
              >
                <span className="font-mono text-sm tabular-nums text-text-primary">
                  {formatTime(slot.slotStart)} – {formatTime(slot.slotEnd)}
                </span>
                <Badge tone={slot.status === "booked" ? "blue" : "emerald"}>
                  {slot.status === "booked" ? "Booked" : "Open"}
                </Badge>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Drawer>
  );
}
