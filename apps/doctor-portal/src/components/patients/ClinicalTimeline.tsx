import { History } from "lucide-react";
import { Badge, EmptyState } from "@healthoraa/ui";
import type { PatientPrescription, PatientVisit } from "../../types/patients";
import { CONSULTATION_STATUS_META, formatTime } from "../queue/consultationMeta";
import { formatDate } from "../../lib/prescriptionOptions";

// Chronological visits, oldest first. Each visit carries the prescription signed for it.
export function ClinicalTimeline({
  visits,
  prescriptions,
  onClose,
}: {
  visits: PatientVisit[];
  prescriptions: PatientPrescription[];
  onClose: () => void;
}) {
  if (visits.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No consultations on record"
        description="Visits and signed prescriptions for this patient will show here."
        action={{ label: "Back to patients", onClick: onClose }}
        className="py-8"
      />
    );
  }

  return (
    <ol className="space-y-5 border-l border-aura-line pl-5">
      {visits.map((visit, index) => {
        const meta = CONSULTATION_STATUS_META[visit.status];
        const rx = prescriptions.filter((p) => p.visitId === visit.id);
        return (
          <li key={visit.id} className="relative">
            <span
              aria-hidden="true"
              className="absolute -left-[1.6rem] top-1 h-3 w-3 rounded-full border-2 border-aura-canvas bg-accent-blue"
            />
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-xs text-text-secondary">
                  {formatDate(new Date(visit.date))} · {formatTime(visit.date)}
                </p>
                <Badge tone={meta.tone}>{meta.label}</Badge>
                {index === visits.length - 1 && <Badge tone="blue">Latest</Badge>}
              </div>
              <p className="text-sm font-semibold text-text-primary">{visit.diagnosis ?? "No diagnosis recorded"}</p>
              {visit.chiefComplaint && <p className="text-xs text-text-secondary">Complaint: {visit.chiefComplaint}</p>}
              {visit.notes && <p className="text-xs leading-relaxed text-text-muted">{visit.notes}</p>}

              {rx.length === 0 ? (
                <p className="text-xs text-text-muted">No prescription signed for this visit.</p>
              ) : (
                rx.map((prescription) => (
                  <div key={prescription.id} className="space-y-2 rounded-2xl border border-aura-line bg-aura-s2 p-3">
                    <p className="text-xs font-mono uppercase tracking-wider text-text-muted">
                      Signed Rx · follow-up in {prescription.followupDays} days
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {prescription.medicines.map((medicine) => (
                        <div key={medicine.name} className="rounded-xl border border-aura-line bg-aura-s1 p-3">
                          <p className="text-sm font-semibold text-text-primary">{medicine.name}</p>
                          <p className="text-xs text-text-secondary">
                            {medicine.dosage} · {medicine.frequency}
                          </p>
                          <p className="font-mono text-[11px] text-text-muted">
                            {medicine.durationDays} days{medicine.instructions ? ` · ${medicine.instructions}` : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
