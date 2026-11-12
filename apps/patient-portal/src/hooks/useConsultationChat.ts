import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { watchTables } from "@healthoraa/ui";
import { consultationMessageSchema } from "@healthoraa/validation";
import { supabase } from "../lib/supabase";
import { usePatient } from "../context/PatientContext";

export interface ChatMessage {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export const consultationChatKey = (consultationId: string) => ["consultations", "messages", consultationId] as const;

interface MessageRow {
  id: string;
  sender_id: string;
  content: string | null;
  created_at: string;
}

const toMessage = (row: MessageRow): ChatMessage => ({
  id: row.id,
  senderId: row.sender_id,
  content: row.content ?? "",
  createdAt: row.created_at,
});

// Adds a message to a thread in time order, unless it is already there.
const appendMessage = (thread: ChatMessage[], message: ChatMessage): ChatMessage[] =>
  thread.some((m) => m.id === message.id)
    ? thread
    : [...thread, message].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

// Follow-up thread for one consultation. Realtime appends each new message to the cache,
// so the thread updates while the drawer is open.
export const useConsultationChat = (consultationId: string) => {
  const queryClient = useQueryClient();

  useEffect(
    () =>
      watchTables<MessageRow>(
        supabase,
        `patient-consultation-messages:${consultationId}`,
        [{ table: "consultation_messages", events: ["INSERT"], filter: `consultation_id=eq.${consultationId}` }],
        (row) => {
          const message = toMessage(row);
          queryClient.setQueryData<ChatMessage[]>(consultationChatKey(consultationId), (thread) =>
            thread ? appendMessage(thread, message) : thread,
          );
        },
      ),
    [consultationId, queryClient],
  );

  return useQuery<ChatMessage[], Error>({
    queryKey: consultationChatKey(consultationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultation_messages")
        .select("id, sender_id, content, created_at")
        .eq("consultation_id", consultationId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return ((data ?? []) as MessageRow[]).map(toMessage);
    },
  });
};

// Sends a message as the patient. RLS allows this only while the follow-up window is open.
export const useSendConsultationMessage = (consultationId: string) => {
  const patient = usePatient();
  const queryClient = useQueryClient();

  return useMutation<ChatMessage, Error, string>({
    mutationFn: async (content) => {
      const parsed = consultationMessageSchema.safeParse({ content });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check your message.");
      const { data, error } = await supabase
        .from("consultation_messages")
        .insert({ consultation_id: consultationId, sender_id: patient.id, content: parsed.data.content })
        .select("id, sender_id, content, created_at")
        .single();
      if (error) throw new Error(`The message was not sent: ${error.message}`);
      return toMessage(data as MessageRow);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: consultationChatKey(consultationId) }),
  });
};
