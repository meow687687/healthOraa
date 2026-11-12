export interface ChatMessage {
  id: string;
  consultationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  // True when the message exists only on this device because the backend was unavailable.
  pending: boolean;
}
