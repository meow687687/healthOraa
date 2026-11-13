import { cn } from "./cn";

// Aura-Dark class tokens shared by every admin view. Keep each string literal
// so Tailwind's content scanner can see it.

export type Tone = "emerald" | "amber" | "red" | "blue" | "violet" | "neutral";

export const TONE_CLASS: Record<Tone, string> = {
  emerald: "text-accent-emerald bg-accent-emerald/10 border-accent-emerald/20",
  amber: "text-accent-amber bg-accent-amber/10 border-accent-amber/20",
  red: "text-accent-red bg-accent-red/10 border-accent-red/20",
  blue: "text-accent-blue bg-accent-blue/10 border-accent-blue/20",
  violet: "text-accent-violet bg-accent-violet/10 border-accent-violet/20",
  neutral: "text-text-secondary bg-aura-s3 border-aura-line2",
};

export const TONE_TEXT: Record<Tone, string> = {
  emerald: "text-accent-emerald",
  amber: "text-accent-amber",
  red: "text-accent-red",
  blue: "text-accent-blue",
  violet: "text-accent-violet",
  neutral: "text-text-secondary",
};

export const PANEL = "bg-aura-s1 border border-aura-line rounded-3xl p-6 shadow-aura-card";
export const SKELETON = "animate-pulse bg-aura-s2 rounded-2xl";
export const PILL = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold font-mono whitespace-nowrap";
export const LABEL = "text-xs font-mono uppercase tracking-wider text-text-muted";
export const TABLE_HEAD = "border-b border-aura-line text-xs font-mono uppercase tracking-wider text-text-muted whitespace-nowrap";
export const NUM = "font-mono tabular-nums whitespace-nowrap text-text-secondary";
export const MONEY = "font-mono tabular-nums whitespace-nowrap font-semibold text-text-primary";

export const INPUT =
  "w-full bg-aura-s2 border border-aura-line rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition-all";
export const ERROR_TEXT = "text-xs text-accent-red";
export const ERROR_BOX = "rounded-xl border border-accent-red/30 bg-accent-red/10 px-4 py-3 text-xs text-accent-red";

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-blue/20";

export const BTN_PRIMARY = cn(
  "inline-flex items-center justify-center gap-2 bg-accent-blue hover:bg-accent-blue/90 text-white font-semibold rounded-full px-5 py-2.5 shadow-lg shadow-accent-blue-glow transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed",
  FOCUS_RING,
);
export const BTN_PRIMARY_BLOCK = cn(BTN_PRIMARY, "w-full px-6 py-3");
export const BTN_SECONDARY_BLOCK =
  "inline-flex w-full items-center justify-center gap-2 bg-aura-s2 hover:bg-aura-s3 border border-aura-line text-text-secondary font-medium py-3 px-6 rounded-full transition-colors disabled:opacity-60";
export const BTN_DANGER = "inline-flex items-center justify-center gap-2 bg-accent-red hover:bg-accent-red/90 text-white font-semibold rounded-full px-5 py-2.5 shadow-lg transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed";
export const BTN_DANGER_BLOCK = cn(BTN_DANGER, "w-full px-6 py-3");
export const BTN_OUTLINE_DANGER_BLOCK =
  "inline-flex w-full items-center justify-center gap-2 border border-accent-red/40 text-accent-red font-semibold py-3 px-6 rounded-full hover:bg-accent-red/10 transition-colors disabled:opacity-60";
export const BTN_TEXT = "px-3 py-1.5 rounded-full text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors disabled:opacity-60";
export const BTN_DANGER_SM = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-red hover:bg-accent-red/90 text-white text-xs font-semibold transition-all disabled:opacity-60";

// Floating action pill: reveals on row hover, row focus, or when the row is active.
export const ROW_REVEAL = "opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100";
export const ROW_PILL = "inline-flex items-center gap-2 rounded-full bg-aura-s3/95 backdrop-blur-md border border-aura-line2 px-4 py-2 shadow-aura-elevated";
export const ROW_MICRO = cn(
  "p-1.5 rounded-full text-text-muted hover:text-white hover:bg-white/10 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-text-muted",
  FOCUS_RING,
);
