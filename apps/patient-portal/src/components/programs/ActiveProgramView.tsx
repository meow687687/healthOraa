import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { BTN_PRIMARY, ERROR_TEXT } from "@healthoraa/ui";
import { usePatient } from "../../context/PatientContext";
import { useActiveProgram } from "../../hooks/useActiveProgram";
import { useSaveDayLog } from "../../hooks/useSaveDayLog";
import { WATER_MAX_ML, WATER_STEP_ML } from "../../lib/meals";
import type { ActiveProgramData, DayLog, MealId } from "../../types/program";
import { ProgressTracker } from "./ProgressTracker";
import { WaterCard } from "./WaterCard";
import { MealComplianceCard } from "./MealComplianceCard";
import { DietitianNoteBanner } from "./DietitianNoteBanner";
import { ProgramChatDrawer } from "../chat/ProgramChatDrawer";
import { NextVisitCard } from "../today/NextVisitCard";

// Re-renders every minute so the visit countdown stays current.
const useNow = (): number => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
};

// The landing screen: what is next, today's plan, then the programme as a whole.
export default function ActiveProgramView({ onOpenConsultations }: { onOpenConsultations: () => void }) {
  const patient = usePatient();
  const query = useActiveProgram();
  const now = useNow();

  // The visit summary sits outside the programme guards, so a programme failure never hides it.
  return (
    <div className="space-y-6">
      <NextVisitCard now={now} onOpen={onOpenConsultations} />
      {query.isPending && <p className="py-16 text-center text-sm text-text-secondary">Loading your program...</p>}
      {!query.isPending && !query.data && (
        <p className="py-16 text-center text-sm text-text-muted">Could not load your program.</p>
      )}
      {query.data && <ProgramDashboard patientId={patient.id} data={query.data} />}
    </div>
  );
}

function ProgramDashboard({ patientId, data }: { patientId: string; data: ActiveProgramData }) {
  const { program, dayLogs } = data;
  const [chatOpen, setChatOpen] = useState(false);
  const save = useSaveDayLog(patientId, program);

  const today: DayLog = dayLogs.find((day) => day.dayNumber === program.currentDay) ?? {
    dayNumber: program.currentDay,
    waterMl: 0,
    meals: [],
  };

  const addWater = () => save.mutate({ ...today, waterMl: Math.min(today.waterMl + WATER_STEP_ML, WATER_MAX_ML) });

  const toggleMeal = (meal: MealId) =>
    save.mutate({
      ...today,
      meals: today.meals.includes(meal) ? today.meals.filter((item) => item !== meal) : [...today.meals, meal],
    });

  return (
    <div className="space-y-6">
      <section aria-labelledby="today-plan-title" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="today-plan-title" className="text-lg font-semibold text-text-primary">Today&apos;s plan</h2>
            <p className="text-sm text-text-secondary">Day {program.currentDay} of {program.durationDays}</p>
          </div>
          <button type="button" onClick={() => setChatOpen(true)} className={BTN_PRIMARY}>
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            Message dietitian
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <WaterCard waterMl={today.waterMl} onAdd={addWater} />
          <MealComplianceCard meals={today.meals} onToggle={toggleMeal} />
        </div>
        {save.isError && <p className={ERROR_TEXT}>Could not save today&apos;s log: {save.error.message}</p>}
      </section>

      <DietitianNoteBanner note={program.latestNote} nutritionistName={program.nutritionist?.name ?? null} />

      <section aria-labelledby="programme-title" className="space-y-4">
        <h2 id="programme-title" className="text-lg font-semibold text-text-primary">Your programme</h2>
        <ProgressTracker program={program} />
      </section>

      <ProgramChatDrawer isOpen={chatOpen} onClose={() => setChatOpen(false)} program={program} />
    </div>
  );
}
