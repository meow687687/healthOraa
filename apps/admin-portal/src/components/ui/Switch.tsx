// Active/inactive switch used in table rows and banner cards.
export function ActiveSwitch({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors disabled:opacity-50 ${
        checked ? "bg-accent-emerald/20 border-accent-emerald/40" : "bg-aura-s3 border-aura-line2"
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
