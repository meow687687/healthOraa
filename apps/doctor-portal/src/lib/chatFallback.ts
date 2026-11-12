import type { ChatMessage } from "../types/chat";

// Mock threads for the offline demo. Each message is placed relative to `anchor`
// so the timestamps stay believable whenever the page is opened.
const THREADS: Record<string, { senderIsDoctor: boolean; content: string; hoursAgo: number }[]> = {
  "fb-consultation-001": [
    { senderIsDoctor: false, hoursAgo: 96, content: "Doctor, the new cysts on my jaw have slowed down. The old ones are still there. Is the metformin dose right?" },
    { senderIsDoctor: true, hoursAgo: 48, content: "That's the expected pattern at week two. Keep the adapalene at night and send me a photo in five days." },
    { senderIsDoctor: false, hoursAgo: 3, content: "Thank you. The cramps have eased and my skin feels less oily. Should I keep the metformin with food?" },
  ],
  "fb-consultation-003": [
    { senderIsDoctor: false, hoursAgo: 120, content: "Home BP readings this week are around 128/84. The dizziness in the mornings has eased." },
    { senderIsDoctor: true, hoursAgo: 72, content: "Good trend. Keep the low-sodium plan and take the evening dose at the same time daily." },
    { senderIsDoctor: false, hoursAgo: 5, content: "Ankle swelling has reduced a lot. I am walking 20 minutes after dinner now." },
  ],
};

const DEFAULT_THREAD = THREADS["fb-consultation-001"];

export const buildFallbackThread = (consultationId: string, doctorId: string, anchor: Date): ChatMessage[] => {
  const thread = THREADS[consultationId] ?? DEFAULT_THREAD;
  return thread.map((entry, index) => ({
    id: `${consultationId}-msg-${index + 1}`,
    consultationId,
    senderId: entry.senderIsDoctor ? doctorId : "patient-mock",
    content: entry.content,
    createdAt: new Date(anchor.getTime() - entry.hoursAgo * 3_600_000).toISOString(),
    pending: false,
  }));
};

// Only the mock queue uses these IDs, so the hook can skip the network for them.
export const isMockConsultation = (consultationId: string): boolean => consultationId.startsWith("fb-");
