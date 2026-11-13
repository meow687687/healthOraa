import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Send } from "lucide-react";
import { Badge, ERROR_BOX, cn } from "@healthoraa/ui";
import { useConsultationChat, useSendMessage } from "../../hooks/useConsultationChat";
import { useDoctor } from "../../context/DoctorContext";
import { daysRemaining, isWindowOpen } from "../../lib/followupWindow";
import { formatDate } from "../../lib/prescriptionOptions";
import type { QueueConsultation } from "../../types/queue";
import type { ChatMessage } from "../../types/chat";
import { formatTime } from "../queue/consultationMeta";

const WINDOW_CLOSED_TEXT = "7-Day follow-up window closed. Patient must book a follow-up consultation.";

// Re-renders every minute so the countdown stays current.
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

// The 7-day follow-up thread. Used inside the consultation room.
export function ChatThread({ consultation }: { consultation: QueueConsultation }) {
  const { doctor } = useDoctor();
  const now = useNow(60_000);
  const thread = useConsultationChat(consultation.id);
  const send = useSendMessage(consultation.id);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLOListElement>(null);

  const expiresAt = consultation.followupExpiresAt;
  const open = isWindowOpen(expiresAt, now);
  const messageCount = thread.data?.length ?? 0;

  // Scroll the thread itself, not the drawer, so the header and composer stay in place.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messageCount]);

  const countdown = (() => {
    if (expiresAt === null) return { label: "Chat Window: not open", tone: "neutral" as const };
    if (!open) return { label: "Chat Window: closed", tone: "red" as const };
    const days = daysRemaining(expiresAt, now);
    return {
      label: `Chat Window: ${days} ${days === 1 ? "day" : "days"} remaining`,
      tone: days >= 3 ? ("emerald" as const) : ("amber" as const),
    };
  })();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!open || send.isPending) return;
    send.mutate({ content: draft, followupExpiresAt: expiresAt }, { onSuccess: () => setDraft("") });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-text-secondary">
          Consultation on {formatDate(new Date(consultation.slotStart))} at {formatTime(consultation.slotStart)}
        </p>
        <Badge tone={countdown.tone} className="tabular-nums">{countdown.label}</Badge>
      </div>

      {!open && (
        <div role="status" className="mt-6 rounded-2xl border border-accent-red/30 bg-accent-red/10 px-4 py-3 text-sm text-accent-red">
          {WINDOW_CLOSED_TEXT}
        </div>
      )}

      <div className="flex min-h-[12rem] flex-1 flex-col py-4">
        {thread.isLoading && <p className="text-xs text-text-muted">Loading conversation...</p>}
        {thread.isError && <div className={ERROR_BOX}>Could not load the conversation.</div>}
        {thread.data && thread.data.length === 0 && (
          <p className="py-8 text-center text-xs text-text-muted">No messages yet. Start the conversation below.</p>
        )}
        {thread.data && thread.data.length > 0 && (
          <ol ref={listRef} aria-label="Messages" className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            {thread.data.map((message) => (
              <MessageBubble key={message.id} message={message} isDoctor={message.senderId === doctor.id} />
            ))}
          </ol>
        )}
      </div>

      {send.isError && <div className={cn(ERROR_BOX, "mb-4")}>{send.error.message}</div>}

      <form onSubmit={onSubmit} noValidate className="flex items-center gap-2 border-t border-aura-line pt-4">
        <label htmlFor="chat-input" className="sr-only">
          Message to patient
        </label>
        <input
          id="chat-input"
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={!open}
          maxLength={1000}
          placeholder={open ? "Write a message to the patient" : "Chat closed"}
          className="min-w-0 flex-1 rounded-full border border-aura-line bg-aura-s2 px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted transition-all focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!open || send.isPending || draft.trim().length === 0}
          aria-label="Send message"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-blue text-white transition-all hover:bg-accent-blue/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

function MessageBubble({ message, isDoctor }: { message: ChatMessage; isDoctor: boolean }) {
  return (
    <li className={cn("flex flex-col", isDoctor ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap px-4 py-2.5 text-sm leading-relaxed text-text-primary",
          isDoctor
            ? "rounded-2xl rounded-tr-[0.125rem] border border-accent-blue/30 bg-accent-blue/15"
            : "rounded-2xl rounded-tl-[0.125rem] border border-aura-line bg-aura-s2",
        )}
      >
        {message.content}
      </div>
      <p className="mt-1 font-mono text-[11px] text-text-muted">
        {isDoctor ? "You" : "Patient"} · {formatTime(message.createdAt)}
        {message.pending && " · Saved on this device, not synced"}
      </p>
    </li>
  );
}
