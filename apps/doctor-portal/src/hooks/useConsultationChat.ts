import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { watchTables } from "@healthoraa/ui";
import { consultationMessageSchema } from "@healthoraa/validation";
import { supabase } from "../lib/supabase";
import { useDoctor } from "../context/DoctorContext";
import { FALLBACK_ANCHOR } from "../lib/fallbackData";
import { buildFallbackThread, isMockConsultation } from "../lib/chatFallback";
import { appendLocalChatMessage, localChatMessages } from "../lib/chatStore";
import { isWindowOpen } from "../lib/followupWindow";
import type { ChatMessage } from "../types/chat";

export const chatMessagesKey = (consultationId: string) =>
  ["consultations", "messages", consultationId] as const;

interface MessageRow {
  id: string;
  consultation_id: string;
  sender_id: string;
  content: string | null;
  created_at: string;
}

const toChatMessage = (row: MessageRow): ChatMessage => ({
  id: row.id,
  consultationId: row.consultation_id,
  senderId: row.sender_id,
  content: row.content ?? "",
  createdAt: row.created_at,
  pending: false,
});

// Adds a message to a thread in time order, unless it is already there.
const appendMessage = (thread: ChatMessage[], message: ChatMessage): ChatMessage[] =>
  thread.some((m) => m.id === message.id)
    ? thread
    : [...thread, message].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

// Remote thread plus anything saved on this device, in chronological order.
const mergeThread = (remote: ChatMessage[], consultationId: string): ChatMessage[] =>
  [...remote, ...localChatMessages(consultationId)].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

// Messages for one consultation, oldest first. Falls back to a mock thread when the
// query fails. Mock consultations never touch the network.
export const useConsultationChat = (consultationId: string) => {
  const { doctor } = useDoctor();
  const queryClient = useQueryClient();

  // Realtime: each new message in this thread is appended to the cache. The doctor's own
  // messages arrive here too, and appendMessage skips ids already in the thread.
  useEffect(() => {
    if (isMockConsultation(consultationId)) return;
    return watchTables<MessageRow>(
      supabase,
      `consultation-messages:${consultationId}`,
      [{ table: "consultation_messages", events: ["INSERT"], filter: `consultation_id=eq.${consultationId}` }],
      (row) => {
        const message = toChatMessage(row);
        queryClient.setQueryData<ChatMessage[]>(chatMessagesKey(consultationId), (thread) =>
          thread ? appendMessage(thread, message) : thread,
        );
      },
    );
  }, [consultationId, queryClient]);

  return useQuery<ChatMessage[], Error>({
    queryKey: chatMessagesKey(consultationId),
    queryFn: async () => {
      const fallback = () =>
        mergeThread(buildFallbackThread(consultationId, doctor.id, FALLBACK_ANCHOR), consultationId);
      if (isMockConsultation(consultationId)) return fallback();

      try {
        const { data, error } = await supabase
          .from("consultation_messages")
          .select("id, consultation_id, sender_id, content, created_at")
          .eq("consultation_id", consultationId)
          .order("created_at", { ascending: true });
        if (error) throw new Error(error.message);
        return mergeThread(((data ?? []) as MessageRow[]).map(toChatMessage), consultationId);
      } catch (err) {
        console.warn("[chat] messages query failed, using client fallback", err);
        return fallback();
      }
    },
  });
};

export interface SendMessageInput {
  content: string;
  followupExpiresAt: string | null;
}

// Posts a message as the doctor. Re-checks the window and the content, since RLS is the
// real enforcement. Messages that cannot be synced are kept on this device and marked pending.
export const useSendMessage = (consultationId: string) => {
  const { doctor } = useDoctor();
  const queryClient = useQueryClient();

  return useMutation<ChatMessage, Error, SendMessageInput>({
    mutationFn: async ({ content, followupExpiresAt }) => {
      const parsed = consultationMessageSchema.safeParse({ content });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid message.");
      if (!isWindowOpen(followupExpiresAt, Date.now())) {
        throw new Error("The 7-day follow-up window has closed.");
      }
      const text = parsed.data.content;

      if (!isMockConsultation(consultationId)) {
        const { data, error } = await supabase
          .from("consultation_messages")
          .insert({ consultation_id: consultationId, sender_id: doctor.id, content: text })
          .select("id, consultation_id, sender_id, content, created_at")
          .single();
        if (!error && data) return toChatMessage(data as MessageRow);
        console.warn("[chat] send failed, keeping message on this device", error);
      }

      const local: ChatMessage = {
        id: crypto.randomUUID(),
        consultationId,
        senderId: doctor.id,
        content: text,
        createdAt: new Date().toISOString(),
        pending: true,
      };
      appendLocalChatMessage(local);
      return local;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chatMessagesKey(consultationId) }),
  });
};
