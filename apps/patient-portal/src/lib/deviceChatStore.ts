import type { ChatMessage } from "../types/program";

// Messages that could not reach the dietitian are kept here, marked as device-only, never dropped.
const STORAGE_KEY = "healthoraa.patient.chat.v1";

type ChatStore = Record<string, ChatMessage[]>;

const readStore = (): ChatStore => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ChatStore) : {};
  } catch {
    return {};
  }
};

export const readDeviceMessages = (enrolmentId: string): ChatMessage[] => readStore()[enrolmentId] ?? [];

export const appendDeviceMessage = (enrolmentId: string, content: string): ChatMessage => {
  const message: ChatMessage = {
    id: `device-${crypto.randomUUID()}`,
    senderRole: "patient",
    content,
    createdAt: new Date().toISOString(),
    storage: "device",
  };
  const store = readStore();
  store[enrolmentId] = [...(store[enrolmentId] ?? []), message];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  return message;
};
