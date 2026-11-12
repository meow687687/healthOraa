import { Download } from "lucide-react";
import { Badge, LABEL, PANEL, cn } from "@healthoraa/ui";
import { formatIstDateTime } from "../../lib/istTime";
import type { ConsultationItem, ConsultationState } from "../../types/consultations";

const STATE_LABEL: Record<ConsultationState, { tone: "emerald" | "amber" | "neutral" | "blue"; label: string }> = {
  confirmed: { tone: "blue", label: "Scheduled" },
  awaiting_payment: { tone: "amber", label: "Awaiting payment" },
  held_on_device: { tone: "amber", label: "Held on device" },
  completed: { tone: "emerald", label: "Completed" },
  cancelled: { tone: "neutral", label: "Cancelled" },
};

export function PastConsultations({ items, onOpenRx }: { items: ConsultationItem[]; onOpenRx: (item: ConsultationItem) => void }) {
  if (items.length === 0) {
    return <p className="text-sm text-text-muted">No past consultations yet.</p>;
  }

  return (
    <ul className={cn(PANEL, "divide-y divide-aura-line p-0")}>
      {items.map((item) => {
        const badge = STATE_LABEL[item.state];
        return (
          <li key={item.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className={LABEL}>{formatIstDateTime(item.startsAt)} IST</p>
              <p className="text-sm font-semibold text-text-primary">{item.doctorName}</p>
              {item.chiefComplaint && <p className="truncate text-xs text-text-secondary">{item.chiefComplaint}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge tone={badge.tone}>{badge.label}</Badge>
                <span className="font-mono text-[11px] text-text-muted">{item.reference}</span>
              </div>
            </div>
            {item.prescription && (
              <button
                type="button"
                onClick={() => onOpenRx(item)}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-aura-line2 bg-aura-s3 px-4 py-2 text-xs font-semibold text-text-primary hover:bg-aura-s2"
              >
                <Download className="h-3.5 w-3.5" />
                Download Digital Rx
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
