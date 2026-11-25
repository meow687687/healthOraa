import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { cn } from "@healthoraa/ui";
import type { RoomPane } from "../../types/queue";

const PANES: { id: RoomPane; label: string }[] = [
  { id: "intake", label: "Intake" },
  { id: "rx", label: "Prescription" },
  { id: "chat", label: "Follow-up chat" },
];

export function RoomSectionTabs({
  pane,
  onChange,
}: {
  pane: RoomPane;
  onChange: (pane: RoomPane) => void;
}) {
  const tabRefs = useRef<Record<RoomPane, HTMLButtonElement | null>>({
    intake: null,
    rx: null,
    chat: null,
  });

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const order = PANES.map((item) => item.id);
    const at = order.indexOf(pane);
    const next =
      event.key === "ArrowRight"
        ? order[(at + 1) % order.length]
        : event.key === "ArrowLeft"
          ? order[(at - 1 + order.length) % order.length]
          : event.key === "Home"
            ? order[0]
            : event.key === "End"
              ? order[order.length - 1]
              : null;
    if (!next) return;
    event.preventDefault();
    onChange(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Room sections"
      className="flex gap-1 rounded-full border border-aura-line2 bg-aura-s1 p-1 lg:hidden"
      onKeyDown={moveFocus}
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
          onClick={() => onChange(item.id)}
          className={cn(
            "min-h-[44px] flex-1 rounded-full px-3 text-[13px] font-semibold cursor-pointer",
            pane === item.id
              ? "bg-aura-s3 text-text-primary"
              : "text-text-muted hover:text-text-primary",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
