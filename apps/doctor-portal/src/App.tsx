import { lazy, Suspense, useState, useTransition } from "react";
import { Calendar, Stethoscope, UserCheck, Users } from "lucide-react";
import { PortalRail, SkeletonBlock, SkipLink } from "@healthoraa/ui";
import { TopBar } from "./components/shell/TopBar";
import { useDoctor } from "./context/DoctorContext";

const ConsultationQueueView = lazy(
  () => import("./components/queue/ConsultationQueueView"),
);
const PractitionerProfileView = lazy(
  () => import("./components/profile/PractitionerProfileView"),
);
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
  const { activeConsultationId, setActiveConsultationId } = useDoctor();

  const selectView = (nextView: DoctorView): void => {
    if (nextView !== "queue") setActiveConsultationId(null);
    startTransition(() => setView(nextView));
  };

  const pageTitle =
    view === "queue" && activeConsultationId
      ? "Consultation room"
      : PAGE_TITLES[view];

  return (
    <div className="h-dvh w-full overflow-hidden bg-aura-canvas font-sans text-text-primary antialiased md:h-auto md:min-h-screen md:overflow-visible">
      <SkipLink />
      <PortalRail groups={GROUPS} active={view} onSelect={selectView} />

      <div className="flex h-full min-h-0 min-w-0 flex-col md:h-auto md:min-h-screen md:pl-16 xl:pl-[232px]">
        <TopBar pageTitle={pageTitle} />
        <main
          id="main-content"
          tabIndex={-1}
          aria-busy={isPending}
          className="mx-auto mb-[calc(5rem+env(safe-area-inset-bottom))] min-h-0 w-full max-w-5xl flex-1 overflow-y-auto p-4 pb-6 md:mb-0 md:overflow-visible md:p-6 md:pb-8 lg:p-8"
        >
          <Suspense
            fallback={
              <div
                aria-busy="true"
                aria-label="Loading workspace"
                className="min-h-[20rem] space-y-5"
              >
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
