import { z } from "zod";

// One message in the post-consultation follow-up chat.
export const consultationMessageSchema = z.object({
  content: z
    .string({ error: "Write a message before sending." })
    .trim()
    .min(1, "Write a message before sending.")
    .max(1000, "Messages must be 1000 characters or fewer."),
});

export type ConsultationMessageInput = z.infer<typeof consultationMessageSchema>;

// The 60-day dietitian chat uses the same message rules as the consultation follow-up chat.
export const programMessageSchema = consultationMessageSchema;
export type ProgramMessageInput = ConsultationMessageInput;
