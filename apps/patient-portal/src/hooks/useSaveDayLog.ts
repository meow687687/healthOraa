import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { upsertDay, writeMockDayLog } from "../lib/progressStore";
import { activeProgramKey } from "./useActiveProgram";
import type { ActiveProgram, ActiveProgramData, DayLog } from "../types/program";

// Saves one day's water and meal log. The view updates at once and rolls back if the save fails.
export const useSaveDayLog = (patientId: string, program: ActiveProgram) => {
  const queryClient = useQueryClient();
  const key = activeProgramKey(patientId);

  return useMutation<DayLog, Error, DayLog, { previous: ActiveProgramData | undefined }>({
    mutationFn: async (day) => {
      if (program.dataSource === "mock") {
        writeMockDayLog(program.enrolmentId, day);
        return day;
      }
      const { error } = await supabase.from("program_progress_logs").upsert(
        {
          enrolment_id: program.enrolmentId,
          day_number: day.dayNumber,
          water_intake_ml: day.waterMl,
          meals_logged: day.meals,
          logged_at: new Date().toISOString(),
        },
        { onConflict: "enrolment_id,day_number" },
      );
      if (error) throw new Error(error.message);
      return day;
    },
    onMutate: async (day) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ActiveProgramData>(key);
      if (previous) {
        queryClient.setQueryData<ActiveProgramData>(key, { ...previous, dayLogs: upsertDay(previous.dayLogs, day) });
      }
      return { previous };
    },
    onError: (_error, _day, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
};
