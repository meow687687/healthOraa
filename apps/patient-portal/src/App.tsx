import { useState } from "react";
import { TopBar } from "./components/shell/TopBar";
import { PatientNav } from "./components/shell/PatientNav";
import type { PatientView } from "./components/shell/PatientNav";
import ActiveProgramView from "./components/programs/ActiveProgramView";
import ConsultationsView from "./components/consultations/ConsultationsView";
import PatientShopView from "./components/shop/PatientShopView";
import HealthLockerView from "./components/locker/HealthLockerView";

export default function App() {
  const [view, setView] = useState<PatientView>("today");

  return (
    <div className="flex min-h-screen w-full flex-col bg-aura-canvas font-sans text-text-primary antialiased">
      <TopBar />

      {/* pb-28 keeps the last card clear of the fixed bottom bar. */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-28 md:px-6 md:pt-6 lg:px-8 lg:pt-8">
        {view === "today" && <ActiveProgramView onOpenConsultations={() => setView("consultations")} />}
        {view === "consultations" && <ConsultationsView />}
        {view === "shop" && <PatientShopView />}
        {view === "locker" && <HealthLockerView />}
      </main>

      <PatientNav active={view} onSelect={setView} />
    </div>
  );
}
