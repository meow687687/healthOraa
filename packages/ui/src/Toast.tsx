import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { cn } from "./cn";

// Every mutation toast leaves the screen after this long.
export const TOAST_DURATION_MS = 3500;

type ToastTone = "success" | "error";

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE_STYLE: Record<ToastTone, string> = {
  success: "border-accent-emerald/30 text-accent-emerald",
  error: "border-accent-red/30 text-accent-red",
};

// Mount once per portal. Renders the stack of toasts and dismisses each one after TOAST_DURATION_MS.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const push = useCallback((tone: ToastTone, message: string) => {
    nextId.current += 1;
    const id = nextId.current;
    setItems((prev) => [...prev, { id, tone, message }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, TOAST_DURATION_MS);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push("success", message),
      error: (message) => push("error", message),
    }),
    [push],
  );

  // The success stack is a polite live region that stays mounted, so its messages are announced.
  // Errors keep their own alert role in a separate stack.
  const successes = items.filter((item) => item.tone === "success");
  const errors = items.filter((item) => item.tone === "error");
  const card = (item: ToastItem) => {
    const Icon = item.tone === "success" ? CircleCheck : CircleAlert;
    return (
      <div
        key={item.id}
        role={item.tone === "error" ? "alert" : undefined}
        className={cn(
          "pointer-events-auto flex items-start gap-3 rounded-2xl border bg-aura-s3 px-4 py-3 text-sm text-text-primary shadow-aura-elevated",
          TONE_STYLE[item.tone],
        )}
      >
        <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1">{item.message}</span>
      </div>
    );
  };
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,22rem)] flex-col gap-2">
        <div role="status" aria-live="polite" className="flex flex-col gap-2">
          {successes.map(card)}
        </div>
        {errors.map(card)}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside ToastProvider");
  return api;
}
