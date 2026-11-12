import { useState } from "react";
import { NavRail } from "./components/shell/NavRail";
import type { DoctorView } from "./components/shell/NavRail";
import { TopBar } from "./components/shell/TopBar";
import ConsultationQueueView from "./components/queue/ConsultationQueueView";
import PractitionerProfileView from "./components/profile/PractitionerProfileView";
import PatientsView from "./components/patients/PatientsView";
import ScheduleView from "./components/schedule/ScheduleView";

export default function App() {
  const [view, setView] = useState<DoctorView>("queue");

  return (
    <div className="flex h-screen w-full overflow-hidden bg-aura-canvas font-sans text-text-primary antialiased">
      <NavRail active={view} onSelect={setView} />

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto pb-20 lg:pb-0">
        <TopBar />
        <div className="mx-auto w-full max-w-5xl p-4 md:p-6 lg:p-8">
          {view === "queue" && <ConsultationQueueView />}
          {view === "schedule" && <ScheduleView />}
          {view === "patients" && <PatientsView />}
          {view === "profile" && <PractitionerProfileView />}
        </div>
      </main>
    </div>
  );
}
