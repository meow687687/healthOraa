import { BTN_PRIMARY, cn } from "@healthoraa/ui";

// Sticky offsets are measured inside main's padding, and main already has pb-20 for the mobile nav.
export function SaveSettingsBar({
  isDirty,
  isSaving,
  errorMessage,
}: {
  isDirty: boolean;
  isSaving: boolean;
  errorMessage: string | null;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-aura-line2 bg-aura-s1/95 p-4 shadow-aura-elevated backdrop-blur-md lg:bottom-4",
      )}
    >
      <p role="status" aria-live="polite" className="min-w-0 text-xs">
        {errorMessage ? (
          <span className="text-accent-red">{errorMessage}</span>
        ) : isDirty ? (
          <span className="text-accent-amber">Unsaved changes</span>
        ) : (
          <span className="text-text-muted">All changes saved</span>
        )}
      </p>
      <button type="submit" disabled={!isDirty || isSaving} className={BTN_PRIMARY}>
        {isSaving ? "Saving..." : "Save Practice Settings"}
      </button>
    </div>
  );
}
