import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@healthoraa/validation";
import type { LoginInput } from "@healthoraa/validation";
import { Badge } from "../Badge";
import { BTN_PRIMARY_BLOCK, ERROR_BOX, ERROR_TEXT, INPUT, LABEL } from "../tokens";
import { AuthCard } from "./AuthCard";
import type { DevPersona } from "./roles";

export function LoginCard({
  portalLabel,
  personas,
  onSignIn,
}: {
  portalLabel: string;
  personas: DevPersona[];
  onSignIn: (email: string, password: string) => Promise<string | null>;
}) {
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { errors } = form.formState;

  const submit = async (values: LoginInput) => {
    setServerError(null);
    setSubmitting(true);
    const error = await onSignIn(values.email, values.password);
    setSubmitting(false);
    if (error) setServerError(error);
  };

  const signInAs = (persona: DevPersona) => {
    form.setValue("email", persona.email, { shouldValidate: true });
    form.setValue("password", persona.password, { shouldValidate: true });
    void form.handleSubmit(submit)();
  };

  return (
    <AuthCard
      badge={<Badge tone="blue">{portalLabel}</Badge>}
      title="Sign in"
      subtitle="Use your HealthOraa account to continue."
    >
      <form noValidate onSubmit={form.handleSubmit(submit)} className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="login-email" className={LABEL}>
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "login-email-error" : undefined}
            className={INPUT}
            {...form.register("email")}
          />
          {errors.email && (
            <p id="login-email-error" className={ERROR_TEXT}>
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="login-password" className={LABEL}>
            Password
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? "login-password-error" : undefined}
            className={INPUT}
            {...form.register("password")}
          />
          {errors.password && (
            <p id="login-password-error" className={ERROR_TEXT}>
              {errors.password.message}
            </p>
          )}
        </div>

        {serverError && (
          <div role="alert" className={ERROR_BOX}>
            {serverError}
          </div>
        )}

        <button type="submit" disabled={submitting} className={BTN_PRIMARY_BLOCK}>
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>

      {personas.length > 0 && (
        <div className="mt-8 space-y-3 border-t border-aura-line pt-6">
          <p className={LABEL}>Dev personas</p>
          <div className="flex flex-col gap-2">
            {personas.map((persona) => (
              <button
                key={persona.email}
                type="button"
                disabled={submitting}
                onClick={() => signInAs(persona)}
                className="flex w-full items-center justify-between gap-3 rounded-full border border-accent-blue/30 bg-accent-blue/10 px-5 py-2.5 text-left text-sm font-semibold text-accent-blue transition-colors hover:bg-accent-blue/20 disabled:opacity-60"
              >
                <span>{persona.label}</span>
                <span className="truncate font-mono text-xs font-normal text-text-muted">{persona.email}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthCard>
  );
}
