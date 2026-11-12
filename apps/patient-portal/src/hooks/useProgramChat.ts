import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { withFallback } from "@healthoraa/ui";
import { programMessageSchema } from "@healthoraa/validation";
import { supabase } from "../lib/supabase";
import { usePatient } from "../context/PatientContext";
import { FALLBACK_MESSAGES } from "../lib/programFallback";
import { appendDeviceMessage, readDeviceMessages } from "../lib/deviceChatStore";
import type { ActiveProgram, ChatMessage } from "../types/program";

export const programMessagesKey = (enrolmentId: string) => ["program", enrolmentId, "messages"] as const;

interface MessageRow {
  id: string;
  sender_id: string;
  content: string | null;
  created_at: string;
}

const toChatMessage = (row: MessageRow, patientId: string): ChatMessage => ({
  id: row.id,
  senderRole: row.sender_id === patientId ? "patient" : "dietitian",
  content: row.content ?? "",
  createdAt: row.created_at,
  storage: "server",
});

const byCreatedAt = (a: ChatMessage, b: ChatMessage): number => Date.parse(a.createdAt) - Date.parse(b.createdAt);

const loadServerMessages = async (enrolmentId: string, patientId: string): Promise<ChatMessage[]> => {
  const { data, error } = await supabase
    .from("program_messages")
    .select("id, sender_id, content, created_at")
    .eq("enrolment_id", enrolmentId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => toChatMessage(row, patientId));
};

// Server thread, falling back to the demo thread when empty, plus any messages kept on this device.
// Demo programs have no server rows, so they skip the query rather than send a non-UUID id.
export const useProgramMessages = (program: ActiveProgram) => {
  const patient = usePatient();

  return useQuery<ChatMessage[], Error>({
    queryKey: programMessagesKey(program.enrolmentId),
    queryFn: async () => {
      const thread =
        program.dataSource === "live"
          ? await withFallback(
              () => loadServerMessages(program.enrolmentId, patient.id),
              FALLBACK_MESSAGES,
              "program messages",
            )
          : FALLBACK_MESSAGES;
      return [...thread, ...readDeviceMessages(program.enrolmentId)].sort(byCreatedAt);
    },
  });
};

// Validates the message, then inserts it. Anonymous inserts are blocked by RLS, so a failed insert
// keeps the message on this device and marks it as device-only rather than losing it.
export const useSendProgramMessage = (program: ActiveProgram) => {
  const patient = usePatient();
  const queryClient = useQueryClient();

  return useMutation<ChatMessage, Error, string>({
    mutationFn: async (content) => {
      const parsed = programMessageSchema.safeParse({ content });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Write a message before sending.");

      if (program.dataSource === "live") {
        const { data, error } = await supabase
          .from("program_messages")
          .insert({ enrolment_id: program.enrolmentId, sender_id: patient.id, content: parsed.data.content })
          .select("id, sender_id, content, created_at")
          .single();
        if (!error && data) return toChatMessage(data, patient.id);
      }

      return appendDeviceMessage(program.enrolmentId, parsed.data.content);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: programMessagesKey(program.enrolmentId) }),
  });
};
