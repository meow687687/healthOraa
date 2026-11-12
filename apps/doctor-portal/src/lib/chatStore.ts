import type { ChatMessage } from "../types/chat";

// Messages that could not be synced go here, so they survive reloads. Keyed by consultation.
const STORAGE_KEY = "healthoraa.doctor.chat.v1";

const load = (): Record<string, ChatMessage[]> => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, ChatMessage[]>) : {};
  } catch {
    return {};
  }
};

let memory = load();

export const localChatMessages = (consultationId: string): ChatMessage[] => memory[consultationId] ?? [];

export const appendLocalChatMessage = (message: ChatMessage): void => {
  memory = {
    ...memory,
    [message.consultationId]: [...localChatMessages(message.consultationId), message],
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // Storage blocked or full: the in-memory copy still shows the message this session.
  }
};
