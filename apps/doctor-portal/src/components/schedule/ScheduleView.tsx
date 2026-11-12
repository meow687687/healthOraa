import { ERROR_BOX, PANEL, cn } from "@healthoraa/ui";
import { useDoctorSchedule } from "../../hooks/useDoctorSchedule";
import { ScheduleEditor } from "./ScheduleEditor";

// Loads the schedule, then hands the working copy to the editor.
export default function ScheduleView() {
  const query = useDoctorSchedule();

  if (query.isPending) {
    return <section className={cn(PANEL, "py-16 text-center text-sm text-text-secondary")}>Loading schedule...</section>;
  }
  if (query.isError || !query.data) {
    return <div className={ERROR_BOX}>Could not load the schedule.</div>;
  }
  return <ScheduleEditor view={query.data} />;
}

