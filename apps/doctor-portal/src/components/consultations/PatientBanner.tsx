import { Badge } from "@healthoraa/ui";
import type { QueueConsultation } from "../../types/queue";
import type { IntakePreview } from "../../lib/intakeFallback";
import { formatTime } from "../queue/consultationMeta";

export function PatientBanner({
  consultation,
  intake,
}: {
  consultation: QueueConsultation;
  intake: IntakePreview | undefined;
}) {
  const ageLine =
    consultation.age !== null
      ? `${consultation.age} yrs · ${consultation.gender ?? "Sex not on file"}`
      : "Age not on file";
  const hasVitals = intake !== undefined && intake.vitals.bloodPressure !== "—";
  const noKnownAllergy = intake?.allergies.every((allergy) => allergy === "None reported") ?? false;

  return (
    <section aria-label="Patient header" className="space-y-4 rounded-2xl border border-aura-line bg-aura-s2 p-4">
      <div className="min-w-0 space-y-1">
        <h3 className="text-base font-semibold text-text-primary">{consultation.patientName}</h3>
        <p className="text-xs font-mono uppercase tracking-wider text-text-muted">
          {ageLine} · {formatTime(consultation.slotStart)}–{formatTime(consultation.slotEnd)}
        </p>
        <p className="text-sm text-text-secondary">{consultation.chiefComplaint ?? "No chief complaint on file"}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {intake === undefined && <Badge tone="neutral">Loading intake…</Badge>}
        {hasVitals && intake && (
          <>
            <Badge tone="neutral">BP {intake.vitals.bloodPressure}</Badge>
            <Badge tone="neutral">Pulse {intake.vitals.pulse}/min</Badge>
            <Badge tone="neutral">{intake.vitals.weightKg} kg</Badge>
            <Badge tone="neutral">{intake.vitals.temperatureC}°C</Badge>
          </>
        )}
        {intake && noKnownAllergy && <Badge tone="emerald">No known allergies</Badge>}
        {intake && !noKnownAllergy && <Badge tone="red">Allergy: {intake.allergies.join(", ")}</Badge>}
      </div>

      {intake && (
        <details open className="text-sm">
          <summary className="cursor-pointer text-xs font-semibold text-accent-blue">Patient intake preview</summary>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-mono uppercase tracking-wider text-text-muted">Symptoms since</dt>
              <dd className="text-text-primary">{intake.symptomsSince}</dd>
            </div>
            <div>
              <dt className="text-xs font-mono uppercase tracking-wider text-text-muted">Medical history</dt>
              <dd className="text-text-primary">
                {intake.medicalHistory.length > 0 ? intake.medicalHistory.join("; ") : "None recorded"}
              </dd>
            </div>
          </dl>
        </details>
      )}
    </section>
  );
}
