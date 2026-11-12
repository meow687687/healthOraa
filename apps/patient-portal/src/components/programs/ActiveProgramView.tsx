import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { BTN_PRIMARY, ERROR_TEXT, cn } from "@healthoraa/ui";
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

export default function ActiveProgramView() {
  const patient = usePatient();
  const query = useActiveProgram();

  if (query.isPending) {
    return <p className="py-16 text-center text-sm text-text-secondary">Loading your program...</p>;
  }
  if (!query.data) {
    return <p className="py-16 text-center text-sm text-text-muted">Could not load your program.</p>;
  }
  return <ProgramDashboard patientId={patient.id} data={query.data} />;
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
      <ProgressTracker program={program} />

      <div className="grid gap-4 md:grid-cols-2">
        <WaterCard waterMl={today.waterMl} onAdd={addWater} />
        <MealComplianceCard meals={today.meals} onToggle={toggleMeal} />
      </div>

      {save.isError && <p className={ERROR_TEXT}>Could not save today&apos;s log: {save.error.message}</p>}

      <DietitianNoteBanner note={program.latestNote} nutritionistName={program.nutritionist?.name ?? null} />

      <button
        type="button"
        onClick={() => setChatOpen(true)}
        className={cn(BTN_PRIMARY, "fixed bottom-24 right-4 z-30 shadow-aura-elevated md:right-8")}
      >
        <MessageCircle className="h-4 w-4" />
        Message Dietitian
      </button>

      <ProgramChatDrawer isOpen={chatOpen} onClose={() => setChatOpen(false)} program={program} />
    </div>
  );
}
