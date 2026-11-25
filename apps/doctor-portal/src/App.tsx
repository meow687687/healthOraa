import { lazy, Suspense, useState, useTransition } from "react";
import { Calendar, Stethoscope, UserCheck, Users } from "lucide-react";
import { PortalRail, SkeletonBlock } from "@healthoraa/ui";
import { TopBar } from "./components/shell/TopBar";

const ConsultationQueueView = lazy(() => import("./components/queue/ConsultationQueueView"));
const PractitionerProfileView = lazy(() => import("./components/profile/PractitionerProfileView"));
const PatientsView = lazy(() => import("./components/patients/PatientsView"));
const ScheduleView = lazy(() => import("./components/schedule/ScheduleView"));

export type DoctorView = "queue" | "schedule" | "patients" | "profile";

const PAGE_TITLES: Record<DoctorView, string> = {
  queue: "Queue",
  schedule: "Schedule",
  patients: "Patients",
  profile: "Profile",
};

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
  const [isPending, startTransition] = useTransition();

  const selectView = (nextView: DoctorView): void => {
    startTransition(() => setView(nextView));
  };

  return (
    <div className="min-h-screen w-full bg-aura-canvas font-sans text-text-primary antialiased">
      <PortalRail groups={GROUPS} active={view} onSelect={selectView} />

      <div className="flex min-h-screen min-w-0 flex-col md:pl-16 xl:pl-[232px]">
        <TopBar pageTitle={PAGE_TITLES[view]} />
        <main aria-busy={isPending} className="mx-auto w-full max-w-5xl flex-1 p-4 pb-32 md:p-6 md:pb-8 lg:p-8">
          <Suspense
            fallback={
              <div aria-busy="true" aria-label="Loading workspace" className="min-h-[20rem] space-y-5">
                <SkeletonBlock className="h-8 w-48" />
                <div className="grid gap-4 md:grid-cols-2">
                  <SkeletonBlock className="h-36" />
                  <SkeletonBlock className="h-36" />
                </div>
                <SkeletonBlock className="h-48" />
              </div>
            }
          >
            <div key={view} className="portal-view-enter">
              {view === "queue" && <ConsultationQueueView />}
              {view === "schedule" && <ScheduleView />}
              {view === "patients" && <PatientsView />}
              {view === "profile" && <PractitionerProfileView />}
            </div>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
