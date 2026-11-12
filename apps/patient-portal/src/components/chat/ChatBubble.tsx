import { cn } from "@healthoraa/ui";
import { formatTime } from "../../lib/format";
import type { ChatMessage } from "../../types/program";

export function ChatBubble({ message }: { message: ChatMessage }) {
  const mine = message.senderRole === "patient";

  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div className="max-w-[80%] space-y-1">
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed text-text-primary",
            mine
              ? "rounded-tr-[0.125rem] border border-accent-blue/20 bg-accent-blue/15"
              : "rounded-tl-[0.125rem] border border-aura-line bg-aura-s2",
          )}
        >
          {message.content}
        </div>
        <p className={cn("font-mono text-[11px] text-text-muted", mine && "text-right")}>
          {formatTime(message.createdAt)}
          {message.storage === "device" && " · Saved on this device only"}
        </p>
      </div>
    </div>
  );
}
