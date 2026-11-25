import type { ReactNode } from "react";
import { FileText } from "lucide-react";
import type { PractitionerWithProfile } from "../../hooks/usePractitioners";
import { formatInr } from "../programs/programMeta";
import { LABEL } from "../ui/tokens";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className={LABEL}>{label}</p>
      <div className="text-sm text-text-primary">{children}</div>
    </div>
  );
}

export function PractitionerAuditDetails({
  practitioner,
  isSeededDemo,
}: {
  practitioner: PractitionerWithProfile;
  isSeededDemo: boolean;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-5">
        <Field label="NMC / IDA Registration">
          <span className="font-mono">{practitioner.registration_number}</span>
        </Field>
        <Field label="Slot Fee">
          <span className="font-mono tabular-nums font-semibold">
            {formatInr(practitioner.consultation_fee_inr)}
          </span>
        </Field>
        <Field label="Qualifications">{practitioner.qualification}</Field>
        <Field label="Slot Duration">
          <span className="font-mono">
            {practitioner.slot_duration_minutes} mins
          </span>
        </Field>
        <Field label="Phone">
          <span className="font-mono">
            {practitioner.profiles.phone ?? "Not on file"}
          </span>
        </Field>
        <Field label="Role">
          <span className="capitalize">{practitioner.profiles.role}</span>
        </Field>
      </div>

      <Field label="Bio">
        {practitioner.bio ? (
          <p className="leading-relaxed text-text-secondary">
            {practitioner.bio}
          </p>
        ) : (
          <p className="text-text-muted">No bio provided.</p>
        )}
      </Field>

      <Field label="Credential Documents">
        {practitioner.documents_url ? (
          <a
            href={practitioner.documents_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-accent-blue hover:underline"
          >
            <FileText className="w-4 h-4" /> View submitted documents
          </a>
        ) : (
          <p className="text-text-muted">No documents uploaded.</p>
        )}
      </Field>

      {isSeededDemo && (
        <div
          role="note"
          className="rounded-2xl border border-accent-amber/30 bg-accent-amber/10 px-4 py-3 space-y-1"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-accent-amber">
            Sample record · demo status only
          </p>
          <p className="text-sm text-text-secondary">
            No credential documents were submitted or reviewed. This seeded
            status is not evidence of a real credential audit.
          </p>
        </div>
      )}

      {practitioner.rejection_reason && (
        <div className="rounded-2xl border border-accent-red/30 bg-accent-red/10 px-4 py-3 space-y-1">
          <p className="text-xs font-mono uppercase tracking-wider text-accent-red">
            Last rejection reason
          </p>
          <p className="text-sm text-text-primary">
            {practitioner.rejection_reason}
          </p>
        </div>
      )}
    </>
  );
}
