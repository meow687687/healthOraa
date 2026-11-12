import type { BiomarkerRange } from "../types/locker";

const NUM = "(-?\\d+(?:\\.\\d+)?)";
const BETWEEN = new RegExp(`^${NUM}\\s*-\\s*${NUM}$`);
const BELOW = new RegExp(`^<\\s*${NUM}$`);
const ABOVE = new RegExp(`^>\\s*${NUM}$`);

// Reads reference-range text such as "4.0 - 5.6", "< 100" or "> 40". Returns null for anything else.
export const parseReferenceRange = (text: string | null): BiomarkerRange | null => {
  if (!text) return null;
  const value = text.trim();

  const between = value.match(BETWEEN);
  if (between) return { min: Number(between[1]), max: Number(between[2]) };

  const below = value.match(BELOW);
  if (below) return { max: Number(below[1]), maxExclusive: true };

  const above = value.match(ABOVE);
  if (above) return { min: Number(above[1]) };

  return null;
};
