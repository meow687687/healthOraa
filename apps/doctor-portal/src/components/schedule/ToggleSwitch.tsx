// Accessible on/off switch in the Aura-Dark style. Matches ActiveSwitch in the admin portal.
export function ToggleSwitch({
  checked,
  disabled = false,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? "border-accent-emerald/40 bg-accent-emerald/20" : "border-aura-line2 bg-aura-s3"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full shadow transition-transform ${
          checked ? "translate-x-6 bg-accent-emerald" : "translate-x-1 bg-text-muted"
        }`}
      />
    </button>
  );
}
