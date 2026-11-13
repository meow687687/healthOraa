import { useRef, useState, type KeyboardEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { BTN_TEXT, ERROR_BOX, PANEL, cn } from "@healthoraa/ui";
import type { QueueConsultation, RoomPane } from "../../types/queue";
import { getStoredPrescription } from "../../lib/prescriptionStore";
import { toFormValues } from "../../lib/prescriptionOptions";
import { isMockConsultation } from "../../lib/chatFallback";
import { useLatestPrescription } from "../../hooks/useLatestPrescription";
import { PrescriptionForm } from "../consultations/PrescriptionForm";
import { ChatThread } from "../chat/ChatThread";
import { timingLine } from "../queue/UpNextCard";
import { RoomIntake } from "./RoomIntake";

const PANES: { id: RoomPane; label: string }[] = [
  { id: "intake", label: "Intake" },
  { id: "rx", label: "Prescription" },
  { id: "chat", label: "Follow-up chat" },
];

interface ConsultationRoomProps {
  consultation: QueueConsultation;
  initialPane: RoomPane;
  now: number;
  onExit: () => void;
  onSigned: () => void;
}

// One screen for the visit: intake on the left, prescription in the middle, follow-up chat on the right.
// Below the large breakpoint the three panes become tabs.
export function ConsultationRoom({ consultation, initialPane, now, onExit, onSigned }: ConsultationRoomProps) {
  const [pane, setPane] = useState<RoomPane>(initialPane);
  const tabRefs = useRef<Record<RoomPane, HTMLButtonElement | null>>({ intake: null, rx: null, chat: null });
  const live = !isMockConsultation(consultation.id);
  const saved = useLatestPrescription(consultation.id);

  // Live visits start from the saved prescription. The form waits for it, so it never opens blank over a saved one.
  const rxBody = (() => {
    if (live && saved.isPending) return <p className="py-10 text-center text-sm text-text-secondary">Loading the saved prescription...</p>;
    if (live && saved.isError && saved.data === undefined) {
      return (
        <div className={ERROR_BOX}>
          Could not load the saved prescription. Leave and reopen the room, so an empty form does not replace it.
        </div>
      );
    }
    const initialValues = live ? (saved.data ?? toFormValues(undefined)) : toFormValues(getStoredPrescription(consultation.id));
    return (
      <>
        {live && saved.isError && (
          <div role="alert" className={cn(ERROR_BOX, "mb-4")}>
            Could not refresh the saved prescription. Your current edits are preserved.
          </div>
        )}
        <PrescriptionForm consultation={consultation} initialValues={initialValues} onCancel={onExit} onSigned={onSigned} />
      </>
    );
  })();

  return (
    <section aria-label="Consultation room" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onExit} className={cn(BTN_TEXT, "inline-flex items-center gap-2")}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to queue
        </button>
        <p className="text-sm text-text-secondary">
          {consultation.patientName} · {timingLine(consultation, now)}
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Room sections"
        className="flex gap-1 rounded-full border border-aura-line2 bg-aura-s1 p-1 lg:hidden"
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          // Arrow keys move between the tabs; Home and End jump to the ends.
          const order = PANES.map((item) => item.id);
          const at = order.indexOf(pane);
          const next =
            event.key === "ArrowRight" ? order[(at + 1) % order.length]
            : event.key === "ArrowLeft" ? order[(at - 1 + order.length) % order.length]
            : event.key === "Home" ? order[0]
            : event.key === "End" ? order[order.length - 1]
            : null;
          if (!next) return;
          event.preventDefault();
          setPane(next);
          tabRefs.current[next]?.focus();
        }}
      >
        {PANES.map((item) => (
          <button
            key={item.id}
            ref={(node) => {
              tabRefs.current[item.id] = node;
            }}
            id={`room-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={pane === item.id}
            aria-controls={`room-panel-${item.id}`}
            tabIndex={pane === item.id ? 0 : -1}
            onClick={() => setPane(item.id)}
            className={cn(
              "min-h-[44px] flex-1 rounded-full px-3 text-[13px] font-semibold cursor-pointer",
              pane === item.id ? "bg-aura-s3 text-text-primary" : "text-text-muted hover:text-text-primary",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        <div id="room-panel-intake" role="tabpanel" aria-labelledby="room-tab-intake" className={pane === "intake" ? "block" : "hidden lg:block"}>
          <RoomIntake consultation={consultation} />
        </div>

        <section
          id="room-panel-rx"
          role="tabpanel"
          aria-labelledby="room-tab-rx"
          className={cn(PANEL, "p-5 md:p-6", pane === "rx" ? "block" : "hidden lg:block")}
        >
          <h3 className="mb-5 text-lg font-semibold text-text-primary">Prescription</h3>
          {rxBody}
        </section>

        <section
          id="room-panel-chat"
          role="tabpanel"
          aria-labelledby="room-tab-chat"
          // A fixed height keeps the thread scrolling inside the pane instead of growing the page.
          className={cn(PANEL, "h-[32rem] flex-col p-5 md:p-6 lg:h-[36rem]", pane === "chat" ? "flex" : "hidden lg:flex")}
        >
          <h3 className="mb-3 text-lg font-semibold text-text-primary">7-day follow-up chat</h3>
          <ChatThread consultation={consultation} />
        </section>
      </div>
    </section>
  );
}
