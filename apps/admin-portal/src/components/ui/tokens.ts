// Design tokens now live in @healthoraa/ui (shared with the doctor portal).
export * from "@healthoraa/ui";

// Admin typography. Section labels and table headers use sentence case in the sans face.
// Mono stays for identifiers, references, timestamps and money. The shared tokens keep their old style
// for the doctor portal, so these overrides apply to the admin only.
export const LABEL = "text-[13px] font-semibold text-text-muted";
export const TABLE_HEAD = "border-b border-aura-line text-[13px] font-medium text-text-muted whitespace-nowrap";
