import { z } from "zod";

const emailField = z.string().trim().pipe(z.email("Enter a valid email address."));

// Password rules here are the minimum the login form enforces. Passwords are not trimmed.
export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const SIGNUP_ROLES = ["patient", "practitioner"] as const;

export const signupSchema = z.object({
  full_name: z.string().trim().min(3, "Full name must be at least 3 characters."),
  email: emailField,
  password: z.string().min(8, "Password must be at least 8 characters."),
  role: z.enum(SIGNUP_ROLES, { error: "Select a valid role." }),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
