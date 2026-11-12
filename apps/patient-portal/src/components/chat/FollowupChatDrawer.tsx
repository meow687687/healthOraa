import { useState } from "react";
import type { FormEvent } from "react";
import { Send } from "lucide-react";
import { BTN_PRIMARY, Drawer, DrawerHeader, ERROR_BOX, INPUT, LABEL, cn } from "@healthoraa/ui";
import { usePatient } from "../../context/PatientContext";
import { useConsultationChat, useSendConsultationMessage } from "../../hooks/useConsultationChat";
import { formatIstDateTime } from "../../lib/istTime";
import type { ConsultationItem } from "../../types/consultations";

// Follow-up chat with the doctor. Open until the consultation's follow-up window closes.
export function FollowupChatDrawer({ item, onClose }: { item: ConsultationItem; onClose: () => void }) {
  const patient = usePatient();
  const thread = useConsultationChat(item.id);
  const send = useSendConsultationMessage(item.id);
  const [draft, setDraft] = useState("");
  const windowOpen = item.followupExpiresAt !== null && Date.now() <= Date.parse(item.followupExpiresAt);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.trim() || send.isPending) return;
    send.mutate(draft, { onSuccess: () => setDraft("") });
  };

  return (
    <Drawer isOpen onClose={onClose} labelledBy="followup-chat-title" className="max-w-xl p-6 md:p-8">
      <DrawerHeader
        eyebrow="7-day follow-up"
        title={`Message ${item.doctorName}`}
        titleId="followup-chat-title"
        onClose={onClose}
      />

      <div className="flex flex-1 flex-col gap-4 py-6">
        {thread.isPending && <p className="text-sm text-text-secondary">Loading messages...</p>}
        {thread.isError && <div className={ERROR_BOX}>Could not load messages. {thread.error.message}</div>}
        {thread.data && thread.data.length === 0 && (
          <p className="text-sm text-text-muted">No messages yet. Ask your doctor a follow-up question.</p>
        )}
        <ol aria-label="Messages" className="flex-1 space-y-3 overflow-y-auto pr-1">
          {(thread.data ?? []).map((message) => {
            const mine = message.senderId === patient.id;
            return (
              <li key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl border px-4 py-3 text-sm",
                    mine
                      ? "border-accent-blue/30 bg-accent-blue/10 text-text-primary"
                      : "border-aura-line bg-aura-s2 text-text-primary",
                  )}
                >
                  <p className={LABEL}>{mine ? "You" : item.doctorName}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words">{message.content}</p>
                  <p className="mt-2 font-mono text-[11px] text-text-muted">{formatIstDateTime(message.createdAt)} IST</p>
                </div>
              </li>
            );
          })}
        </ol>

        {!windowOpen && (
          <p className="rounded-xl border border-aura-line bg-aura-s2 px-4 py-3 text-xs text-text-secondary">
            The 7-day follow-up window has closed. Book a new consultation to continue.
          </p>
        )}
        {send.isError && <div className={ERROR_BOX}>{send.error.message}</div>}

        <form onSubmit={onSubmit} className="flex items-center gap-2">
          <label htmlFor="followup-message" className="sr-only">
            Message
          </label>
          <input
            id="followup-message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={!windowOpen}
            placeholder={windowOpen ? "Write a message to your doctor" : "Chat closed"}
            className={cn(INPUT, "rounded-full")}
          />
          <button
            type="submit"
            aria-label="Send message"
            disabled={!windowOpen || send.isPending || !draft.trim()}
            className={cn(BTN_PRIMARY, "shrink-0 px-4")}
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </Drawer>
  );
}
