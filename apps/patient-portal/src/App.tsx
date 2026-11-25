import { lazy, Suspense, useState, useTransition } from "react";
import { SkeletonBlock } from "@healthoraa/ui";
import { TopBar } from "./components/shell/TopBar";
import { PatientNav } from "./components/shell/PatientNav";
import type { PatientView } from "./components/shell/PatientNav";

const ActiveProgramView = lazy(() => import("./components/programs/ActiveProgramView"));
const ProgramCatalogView = lazy(() => import("./components/programs/ProgramCatalogView"));
const ConsultationsView = lazy(() => import("./components/consultations/ConsultationsView"));
const PatientShopView = lazy(() => import("./components/shop/PatientShopView"));
const HealthLockerView = lazy(() => import("./components/locker/HealthLockerView"));

export default function App() {
  const [view, setView] = useState<PatientView>("today");
  const [isPending, startTransition] = useTransition();

  const selectView = (nextView: PatientView): void => {
    startTransition(() => setView(nextView));
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-aura-canvas font-sans text-text-primary antialiased">
      <TopBar />
      <PatientNav active={view} onSelect={selectView} />

      {/* Leave room for phone navigation; wide screens use the navigation row above the page. */}
      <main aria-busy={isPending} className="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-28 md:px-6 md:pt-6 lg:px-8 lg:pt-8 lg:pb-8">
        <Suspense
          fallback={
            <div aria-busy="true" aria-label="Loading workspace" className="min-h-[20rem] space-y-5">
              <SkeletonBlock className="h-8 w-48" />
              <div className="grid gap-4 sm:grid-cols-2">
                <SkeletonBlock className="h-36" />
                <SkeletonBlock className="h-36" />
              </div>
              <SkeletonBlock className="h-48" />
            </div>
          }
        >
          <div key={view} className="portal-view-enter">
            {view === "today" && <ActiveProgramView onOpenConsultations={() => selectView("consultations")} />}
            {view === "programs" && <ProgramCatalogView />}
            {view === "consultations" && <ConsultationsView />}
            {view === "shop" && <PatientShopView />}
            {view === "locker" && <HealthLockerView />}
          </div>
        </Suspense>
      </main>

    </div>
  );
}
