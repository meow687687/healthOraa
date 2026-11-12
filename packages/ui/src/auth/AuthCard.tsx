import type { ReactNode } from "react";
import { LABEL } from "../tokens";

// Full-height centred page used by every auth screen.
export function AuthPage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-aura-canvas p-4 font-sans text-text-primary antialiased">
      {children}
    </div>
  );
}

export function AuthCard({
  badge,
  title,
  subtitle,
  children,
}: {
  badge: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <AuthPage>
      <section className="w-full max-w-md rounded-3xl border border-aura-line bg-aura-s1 p-8 shadow-aura-elevated">
        <div className="space-y-3">
          {badge}
          <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
          <p className="text-sm text-text-secondary">{subtitle}</p>
        </div>
        <div className="mt-8">{children}</div>
      </section>
    </AuthPage>
  );
}

export function AuthSplash({ label }: { label: string }) {
  return (
    <AuthPage>
      <p className={LABEL}>{label}</p>
    </AuthPage>
  );
}
