import { useState } from "react";
import { Calendar, Stethoscope, UserCheck, Users } from "lucide-react";
import { PortalRail } from "@healthoraa/ui";
import { TopBar } from "./components/shell/TopBar";
import ConsultationQueueView from "./components/queue/ConsultationQueueView";
import PractitionerProfileView from "./components/profile/PractitionerProfileView";
import PatientsView from "./components/patients/PatientsView";
import ScheduleView from "./components/schedule/ScheduleView";

export type DoctorView = "queue" | "schedule" | "patients" | "profile";

const GROUPS = [
  {
    id: "main",
    title: null,
    items: [
      { id: "queue" as const, label: "Queue", icon: Stethoscope },
      { id: "schedule" as const, label: "Schedule", icon: Calendar },
      { id: "patients" as const, label: "Patients", icon: Users },
      { id: "profile" as const, label: "Profile", icon: UserCheck },
    ],
  },
];

export default function App() {
  const [view, setView] = useState<DoctorView>("queue");

  return (
    <div className="min-h-screen w-full bg-aura-canvas font-sans text-text-primary antialiased">
      <PortalRail groups={GROUPS} active={view} onSelect={setView} />

      <div className="flex min-h-screen min-w-0 flex-col md:pl-16 xl:pl-[232px]">
        <TopBar />
        <main className="mx-auto w-full max-w-5xl flex-1 p-4 pb-24 md:p-6 md:pb-8 lg:p-8">
          {view === "queue" && <ConsultationQueueView />}
          {view === "schedule" && <ScheduleView />}
          {view === "patients" && <PatientsView />}
          {view === "profile" && <PractitionerProfileView />}
        </main>
      </div>
    </div>
  );
}
