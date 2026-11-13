import { Download, History, MessageCircle } from "lucide-react";
import { Badge, EmptyState, LABEL, PANEL, cn } from "@healthoraa/ui";
import { formatIstDateTime } from "../../lib/istTime";
import type { ConsultationItem, ConsultationState } from "../../types/consultations";

const STATE_LABEL: Record<ConsultationState, { tone: "emerald" | "amber" | "neutral" | "blue"; label: string }> = {
  confirmed: { tone: "blue", label: "Scheduled" },
  awaiting_payment: { tone: "amber", label: "Awaiting payment" },
  held_on_device: { tone: "amber", label: "Held on device" },
  completed: { tone: "emerald", label: "Completed" },
  cancelled: { tone: "neutral", label: "Cancelled" },
};

// The follow-up chat is offered on completed consultations while their window is open.
const chatOpen = (item: ConsultationItem): boolean =>
  item.state === "completed" && item.followupExpiresAt !== null && Date.parse(item.followupExpiresAt) > Date.now();

export function PastConsultations({
  items,
  onOpenRx,
  onOpenChat,
  onFindDoctor,
}: {
  items: ConsultationItem[];
  onOpenRx: (item: ConsultationItem) => void;
  onOpenChat: (item: ConsultationItem) => void;
  onFindDoctor: () => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No past consultations yet"
        description="Completed and cancelled consultations will be listed here."
        action={{ label: "Find a doctor", onClick: onFindDoctor }}
      />
    );
  }

  return (
    <ul className={cn(PANEL, "divide-y divide-aura-line p-0")}>
      {items.map((item) => {
        const badge = STATE_LABEL[item.state];
        return (
          <li key={item.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className={cn(LABEL, "tabular-nums")}>{formatIstDateTime(item.startsAt)} IST</p>
              <p className="text-sm font-semibold text-text-primary">{item.doctorName}</p>
              {item.chiefComplaint && <p className="truncate text-xs text-text-secondary">{item.chiefComplaint}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge tone={badge.tone}>{badge.label}</Badge>
                <span className="font-mono text-[11px] text-text-muted">{item.reference}</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {chatOpen(item) && (
                <button
                  type="button"
                  onClick={() => onOpenChat(item)}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-accent-blue/30 bg-accent-blue/10 px-4 py-2 text-xs font-semibold text-accent-blue hover:bg-accent-blue/20"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Message doctor
                </button>
              )}
              {item.prescription && (
                <button
                  type="button"
                  onClick={() => onOpenRx(item)}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-aura-line2 bg-aura-s3 px-4 py-2 text-xs font-semibold text-text-primary hover:bg-aura-s2"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download Digital Rx
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
