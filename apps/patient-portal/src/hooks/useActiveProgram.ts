import { useQuery } from "@tanstack/react-query";
import { withSingleFallback } from "@healthoraa/ui";
import type { ProgramCategory } from "@healthoraa/types";
import { supabase } from "../lib/supabase";
import { usePatient } from "../context/PatientContext";
import { programDayFor } from "../lib/programDay";
import { FALLBACK_PROGRAM } from "../lib/programFallback";
import { readMockDayLogs } from "../lib/progressStore";
import { MEAL_IDS } from "../types/program";
import type { ActiveProgram, ActiveProgramData, DayLog, MealId, ProgramNote } from "../types/program";

export const activeProgramKey = (patientId: string) => ["program", "active", patientId] as const;

const ENROLMENT_SELECT =
  "id, started_at, expires_at, programs(title, category, duration_days), dietitian:profiles!program_enrolments_dietitian_id_fkey(full_name)";

interface EnrolmentRow {
  id: string;
  started_at: string;
  expires_at: string;
  programs: { title: string; category: ProgramCategory; duration_days: number } | null;
  dietitian: { full_name: string } | null;
}

const PROTOCOL_LABEL: Record<ProgramCategory, string> = {
  pcod_pcos: "PCOD Protocol",
  weight_management: "Weight Protocol",
  dermato_nutrition: "Dermato Protocol",
  custom: "Custom Protocol",
};

// Drops anything in meals_logged that is not a known meal id.
const parseMeals = (value: unknown): MealId[] =>
  Array.isArray(value)
    ? value.filter((item): item is MealId => typeof item === "string" && (MEAL_IDS as readonly string[]).includes(item))
    : [];

export const toActiveProgram = (row: EnrolmentRow, now: Date, latestNote: ProgramNote | null): ActiveProgram => {
  const durationDays = row.programs?.duration_days ?? 60;
  return {
    enrolmentId: row.id,
    title: row.programs?.title ?? "Nutrition program",
    protocolLabel: PROTOCOL_LABEL[row.programs?.category ?? "custom"],
    durationDays,
    currentDay: programDayFor(row.started_at, durationDays, now),
    startsAt: row.started_at,
    expiresAt: row.expires_at,
    nutritionist: row.dietitian ? { name: row.dietitian.full_name } : null,
    latestNote,
    dataSource: "live",
  };
};

const loadDayLogs = async (enrolmentId: string): Promise<DayLog[]> => {
  const { data, error } = await supabase
    .from("program_progress_logs")
    .select("day_number, water_intake_ml, meals_logged")
    .eq("enrolment_id", enrolmentId)
    .order("day_number", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    dayNumber: row.day_number,
    waterMl: row.water_intake_ml ?? 0,
    meals: parseMeals(row.meals_logged),
  }));
};

// The newest log entry that carries dietitian feedback, or null when there is none.
const loadLatestNote = async (enrolmentId: string): Promise<ProgramNote | null> => {
  const { data, error } = await supabase
    .from("program_progress_logs")
    .select("dietitian_feedback, logged_at")
    .eq("enrolment_id", enrolmentId)
    .not("dietitian_feedback", "is", null)
    .order("logged_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.dietitian_feedback) return null;
  return { body: data.dietitian_feedback, postedAt: data.logged_at };
};

const loadLiveData = async (patientId: string, now: Date): Promise<ActiveProgramData> => {
  const { data, error } = await supabase
    .from("program_enrolments")
    .select(ENROLMENT_SELECT)
    .eq("patient_id", patientId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No active program enrolment for this patient.");

  const row = data as EnrolmentRow;
  const [dayLogs, latestNote] = await Promise.all([loadDayLogs(row.id), loadLatestNote(row.id)]);
  return { program: toActiveProgram(row, now, latestNote), dayLogs };
};

const loadMockData = (): ActiveProgramData => ({
  program: FALLBACK_PROGRAM,
  dayLogs: readMockDayLogs(FALLBACK_PROGRAM.enrolmentId),
});

// The patient's active programme enrolment and its day logs. Falls back to the demo programme when the read fails or finds none.
export const useActiveProgram = () => {
  const patient = usePatient();

  return useQuery<ActiveProgramData, Error>({
    queryKey: activeProgramKey(patient.id),
    queryFn: () => withSingleFallback(() => loadLiveData(patient.id, new Date()), loadMockData(), "active program"),
  });
};
