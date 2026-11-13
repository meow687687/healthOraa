import { useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Badge, Drawer, DrawerHeader, LABEL, PANEL, cn } from "@healthoraa/ui";
import type { PatientRecord } from "../../types/patients";
import { ClinicalTimeline } from "./ClinicalTimeline";
import { LabVault } from "./LabVault";

export function PatientDossierDrawer({ patient, onClose }: { patient: PatientRecord | null; onClose: () => void }) {
  // Keep the last patient mounted while the drawer slides out.
  const [shown, setShown] = useState<PatientRecord | null>(patient);
  if (patient && patient !== shown) setShown(patient);

  return (
    <Drawer isOpen={patient !== null} onClose={onClose} labelledBy="dossier-title" className="max-w-3xl p-6 md:p-8">
      {shown && <DossierBody key={shown.id} patient={shown} onClose={onClose} />}
    </Drawer>
  );
}

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1 rounded-2xl border border-aura-line bg-aura-s2 p-4">
      <p className={LABEL}>{label}</p>
      <div className="text-sm text-text-primary">{children}</div>
    </div>
  );
}

function DossierBody({ patient, onClose }: { patient: PatientRecord; onClose: () => void }) {
  const vitals = patient.latestIntake?.vitals ?? null;
  const hasAlerts = patient.allergies.length > 0 || patient.drugAlerts.length > 0;
  const ageSex = patient.age !== null && patient.sex ? `${patient.age} yrs · ${patient.sex}` : "Age and sex not on file";

  return (
    <>
      <DrawerHeader eyebrow="Patient dossier" title={patient.name} titleId="dossier-title" onClose={onClose}>
        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral">{ageSex}</Badge>
          <Badge tone={patient.dataSource === "live" ? "emerald" : "amber"}>
            {patient.dataSource === "live" ? "Live record" : "Mock record"}
          </Badge>
        </div>
      </DrawerHeader>

      <div className="flex-1 space-y-8 py-6">
        <section aria-labelledby="dossier-demographics" className="space-y-3">
          <h3 id="dossier-demographics" className={LABEL}>Demographics &amp; contact</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Tile label="Blood group">
              <span className="font-mono text-base font-semibold">{patient.bloodGroup ?? "Not on file"}</span>
            </Tile>
            <Tile label="Contact">
              <p className="font-mono">{patient.phone ?? "No phone on file"}</p>
            </Tile>
            <Tile label="Emergency contact">
              {patient.emergencyContact ? (
                <p>
                  {patient.emergencyContact.name} ({patient.emergencyContact.relation})
                  <span className="block font-mono text-xs text-text-muted">{patient.emergencyContact.phone}</span>
                </p>
              ) : (
                <p className="text-text-muted">Not on file</p>
              )}
            </Tile>
            <Tile label="Medical history">
              {patient.latestIntake && patient.latestIntake.medicalHistory.length > 0 ? (
                <ul className="list-disc space-y-0.5 pl-4 text-text-secondary">
                  {patient.latestIntake.medicalHistory.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-text-muted">None recorded</p>
              )}
            </Tile>
          </div>
        </section>

        <section aria-labelledby="dossier-vitals" className="space-y-3">
          <h3 id="dossier-vitals" className={LABEL}>Emergency vitals (latest intake)</h3>
          {vitals ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tile label="Blood pressure"><span className="font-mono">{vitals.bloodPressure}</span></Tile>
              <Tile label="Pulse"><span className="font-mono">{vitals.pulse}/min</span></Tile>
              <Tile label="Weight"><span className="font-mono">{vitals.weightKg} kg</span></Tile>
              <Tile label="BMI"><span className="font-mono">{vitals.bmi.toFixed(1)}</span></Tile>
            </div>
          ) : (
            <p className="rounded-2xl border border-aura-line bg-aura-s2 px-4 py-3 text-xs text-text-muted">
              No intake vitals recorded for this patient.
            </p>
          )}
          {patient.latestIntake && (
            <p className="text-xs text-text-secondary">
              <span className="font-semibold text-text-primary">Presenting complaint:</span> {patient.latestIntake.chiefComplaint}
              {patient.latestIntake.symptomsSince && ` (symptoms for ${patient.latestIntake.symptomsSince})`}
            </p>
          )}
        </section>

        {hasAlerts ? (
          <section aria-labelledby="dossier-alerts" className="space-y-2 rounded-2xl border border-accent-red/20 bg-accent-red/10 p-4 text-accent-red">
            <h3 id="dossier-alerts" className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Known allergies &amp; drug alerts
            </h3>
            {patient.allergies.length > 0 && (
              <p className="text-sm text-text-primary">
                <span className="font-semibold text-accent-red">Allergies:</span> {patient.allergies.join(", ")}
              </p>
            )}
            {patient.drugAlerts.map((alert) => (
              <p key={alert} className="text-sm text-text-primary">
                <span className="font-semibold text-accent-red">Alert:</span> {alert}
              </p>
            ))}
          </section>
        ) : (
          <section className={cn(PANEL, "p-4 text-sm text-text-secondary")}>
            No known allergies or drug alerts recorded.
          </section>
        )}

        <section aria-labelledby="dossier-history" className="space-y-3">
          <h3 id="dossier-history" className={LABEL}>Clinical history</h3>
          <ClinicalTimeline visits={patient.visits} prescriptions={patient.prescriptions} onClose={onClose} />
        </section>

        <section aria-labelledby="dossier-labs" className="space-y-3">
          <h3 id="dossier-labs" className={LABEL}>Diagnostic lab vault</h3>
          <LabVault reports={patient.labReports} />
        </section>
      </div>
    </>
  );
}
