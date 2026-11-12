import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Send } from "lucide-react";
import { programMessageSchema } from "@healthoraa/validation";
import type { ProgramMessageInput } from "@healthoraa/validation";
import { BTN_PRIMARY, Drawer, DrawerHeader, ERROR_TEXT, INPUT, cn } from "@healthoraa/ui";
import { formatDate } from "../../lib/format";
import { useProgramMessages, useSendProgramMessage } from "../../hooks/useProgramChat";
import type { ActiveProgram } from "../../types/program";
import { ChatBubble } from "./ChatBubble";

export function ProgramChatDrawer({
  isOpen,
  onClose,
  program,
}: {
  isOpen: boolean;
  onClose: () => void;
  program: ActiveProgram;
}) {
  const messages = useProgramMessages(program);
  const send = useSendProgramMessage(program);
  const listRef = useRef<HTMLDivElement>(null);
  const chatOpen = new Date() < new Date(program.expiresAt);
  const count = messages.data?.length ?? 0;

  const { register, handleSubmit, reset, formState } = useForm<ProgramMessageInput>({
    resolver: zodResolver(programMessageSchema),
    mode: "onTouched",
    defaultValues: { content: "" },
  });

  // Keep the newest message in view when the drawer opens or a message arrives.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [count, isOpen]);

  const onSubmit = async (values: ProgramMessageInput) => {
    try {
      await send.mutateAsync(values.content);
      reset({ content: "" });
    } catch {
      // Shown below the composer; the draft stays so nothing is retyped.
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} labelledBy="program-chat-title" className="max-w-xl p-6 md:p-8">
      <DrawerHeader
        eyebrow={`${program.protocolLabel} · Day ${program.currentDay} of ${program.durationDays}`}
        title="Message Dietitian"
        titleId="program-chat-title"
        onClose={onClose}
      >
        <p className="text-xs text-text-secondary">
          {program.nutritionist?.name ?? "Your dietitian"} ·{" "}
          {chatOpen ? `Chat open until ${formatDate(program.expiresAt)}` : `Chat closed on ${formatDate(program.expiresAt)}`}
        </p>
      </DrawerHeader>

      <div ref={listRef} role="log" aria-live="polite" className="min-h-0 flex-1 space-y-3 overflow-y-auto py-6">
        {messages.isPending && <p className="text-center text-xs text-text-muted">Loading messages...</p>}
        {messages.data?.length === 0 && (
          <p className="text-center text-xs text-text-muted">No messages yet. Ask about today&apos;s plan.</p>
        )}
        {messages.data?.map((message) => <ChatBubble key={message.id} message={message} />)}
      </div>

      {chatOpen ? (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-2 border-t border-aura-line pt-4">
          <label htmlFor="program-chat-input" className="sr-only">
            Message your dietitian
          </label>
          <textarea
            id="program-chat-input"
            rows={2}
            placeholder="Ask about today's plan"
            aria-invalid={Boolean(formState.errors.content)}
            className={cn(INPUT, "resize-none")}
            {...register("content")}
          />
          {formState.errors.content && <p className={ERROR_TEXT}>{formState.errors.content.message}</p>}
          {send.isError && <p className={ERROR_TEXT}>{send.error.message}</p>}
          <div className="flex justify-end">
            <button type="submit" disabled={send.isPending} className={BTN_PRIMARY}>
              <Send className="h-4 w-4" />
              Send
            </button>
          </div>
        </form>
      ) : (
        <p className="border-t border-aura-line pt-4 text-xs text-text-muted">
          This 60-day chat has closed. Book a consultation to continue with your doctor.
        </p>
      )}
    </Drawer>
  );
}
