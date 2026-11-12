import type { Biomarker, BiomarkerReading } from "../types/locker";
import { parseReferenceRange } from "./referenceRange";

// One row of patient_biomarkers, as the locker reads it.
export interface BiomarkerRow {
  marker_name: string;
  marker_value: number;
  unit: string;
  reference_range: string | null;
  tested_at: string;
}

// The four headline markers, in the order the strip shows them.
const KPI_MARKERS: { name: string; label: string }[] = [
  { name: "hba1c", label: "HbA1c" },
  { name: "fasting_blood_sugar", label: "Fasting Blood Sugar" },
  { name: "tsh", label: "TSH" },
  { name: "ldl_cholesterol", label: "LDL Cholesterol" },
];

// Groups rows into one trend per headline marker. The latest row sets the unit and the reference range.
export const buildBiomarkers = (rows: BiomarkerRow[]): Biomarker[] =>
  KPI_MARKERS.flatMap(({ name, label }) => {
    const series = rows
      .filter((row) => row.marker_name === name)
      .sort((a, b) => a.tested_at.localeCompare(b.tested_at));
    if (series.length === 0) return [];

    const latest = series[series.length - 1];
    const readings: BiomarkerReading[] = series.map((row) => ({ date: row.tested_at, value: Number(row.marker_value) }));
    return [
      {
        key: name,
        label,
        unit: latest.unit,
        range: parseReferenceRange(latest.reference_range) ?? {},
        referenceLabel: latest.reference_range ? `Reference ${latest.reference_range}` : "No reference range on file",
        readings,
      },
    ];
  });

export type BiomarkerStatus = "healthy" | "elevated";

export const latestReading = (biomarker: Biomarker): BiomarkerReading => biomarker.readings[biomarker.readings.length - 1];

// Healthy when the latest reading sits inside the reference range. Missing bounds are open.
export const statusOf = (biomarker: Biomarker): BiomarkerStatus => {
  const { value } = latestReading(biomarker);
  const { min, max, maxExclusive } = biomarker.range;
  const aboveMin = min === undefined || value >= min;
  const belowMax = max === undefined || (maxExclusive ? value < max : value <= max);
  return aboveMin && belowMax ? "healthy" : "elevated";
};

// SVG polyline points for a sparkline, scaled into a width-by-height box with padding.
export const sparklinePoints = (biomarker: Biomarker, width: number, height: number): string => {
  const values = biomarker.readings.map((reading) => reading.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 4;
  return biomarker.readings
    .map((reading, index) => {
      const x = biomarker.readings.length === 1 ? width / 2 : (index / (biomarker.readings.length - 1)) * width;
      const y = pad + (1 - (reading.value - min) / span) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
};
