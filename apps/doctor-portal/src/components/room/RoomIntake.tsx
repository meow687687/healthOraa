import { Badge } from "@healthoraa/ui";
import type { QueueConsultation } from "../../types/queue";
import { intakeFor } from "../../lib/intakeFallback";
import { isMockConsultation } from "../../lib/chatFallback";
import { IntakeSummary } from "../queue/IntakeSummary";

// Intake the doctor reads before the call. Live visits show only what is stored. Vitals and history are
// not captured yet, so they say so. Demo visits also show their sample vitals.
export function RoomIntake({ consultation: live }: { consultation: QueueConsultation }) {
  const demo = isMockConsultation(live.id);
  const sample = demo ? intakeFor(live.id) : null;
  // Demo visits show their sample intake, so the allergy badge matches the sample vitals below it.
  const consultation: QueueConsultation = sample
    ? { ...live, symptomsDuration: sample.symptomsSince, allergies: sample.allergies.filter((a) => a !== "None reported") }
    : live;
  const intakeOnFile = consultation.age !== null || consultation.symptomsDuration != null;
  const allergies = consultation.allergies ?? [];
  const allergiesRecorded = consultation.allergies !== undefined;

  return (
    <section aria-label="Patient intake" className="space-y-5 rounded-3xl border border-aura-line bg-aura-s1 p-5">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-text-primary">{consultation.patientName}</h3>
      </div>

      <div className="flex flex-wrap gap-2">
        {!intakeOnFile && <Badge tone="neutral">Intake not on file</Badge>}
        {!allergiesRecorded && <Badge tone="neutral">Allergies not recorded</Badge>}
        {allergiesRecorded && allergies.length > 0 && <Badge tone="red">Allergy: {allergies.join(", ")}</Badge>}
        {allergiesRecorded && allergies.length === 0 && <Badge tone="emerald">No allergies reported</Badge>}
      </div>

      <IntakeSummary consultation={consultation} stacked />

      {sample ? (
        <div className="space-y-3 border-t border-aura-line pt-4 text-sm">
          <p className="text-[13px] text-text-muted">Sample vitals (demo visit)</p>
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">BP {sample.vitals.bloodPressure}</Badge>
            <Badge tone="neutral">Pulse {sample.vitals.pulse}/min</Badge>
            <Badge tone="neutral">{sample.vitals.weightKg} kg</Badge>
            <Badge tone="neutral">{sample.vitals.temperatureC}°C</Badge>
          </div>
          <p className="text-text-secondary">
            {sample.medicalHistory.length > 0 ? sample.medicalHistory.join("; ") : "No medical history recorded"}
          </p>
        </div>
      ) : (
        <p className="border-t border-aura-line pt-4 text-[13px] text-text-muted">
          Vitals and medical history are not captured in the app yet.
        </p>
      )}
    </section>
  );
}
