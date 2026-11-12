import { useState } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, FileText, Loader2, XCircle } from "lucide-react";
import { formatInr } from "../programs/programMeta";
import { useReviewPractitioner } from "../../hooks/usePractitioners";
import type { PractitionerWithProfile } from "../../hooks/usePractitioners";
import { Drawer, DrawerHeader } from "../ui/Drawer";
import { Badge } from "../ui/Badge";
import { cn } from "../../lib/cn";
import {
  BTN_DANGER_BLOCK,
  BTN_OUTLINE_DANGER_BLOCK,
  BTN_PRIMARY_BLOCK,
  BTN_SECONDARY_BLOCK,
  ERROR_BOX,
  ERROR_TEXT,
  INPUT,
  LABEL,
} from "../ui/tokens";
import type { Tone } from "../ui/tokens";

interface PractitionerAuditDrawerProps {
  practitioner: PractitionerWithProfile | null;
  onClose: () => void;
}

const MIN_REASON_LENGTH = 10;

const VERIFICATION_META: Record<PractitionerWithProfile["verification_status"], { label: string; tone: Tone }> = {
  verified: { label: "Verified", tone: "emerald" },
  pending: { label: "Pending Review", tone: "amber" },
  rejected: { label: "Rejected", tone: "red" },
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className={LABEL}>{label}</p>
      <div className="text-sm text-text-primary">{children}</div>
    </div>
  );
}

export default function PractitionerAuditDrawer({ practitioner, onClose }: PractitionerAuditDrawerProps) {
  const [isRejecting, setIsRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const review = useReviewPractitioner();

  const isOpen = practitioner !== null;
  const status = practitioner?.verification_status ?? "pending";
  const statusMeta = VERIFICATION_META[status];

  const handleClose = () => {
    setIsRejecting(false);
    setReason("");
    setReasonError(null);
    review.reset();
    onClose();
  };

  const handleVerify = () => {
    if (!practitioner) return;
    review.mutate({ id: practitioner.id, decision: "verified" }, { onSuccess: handleClose });
  };

  const handleRejectSubmit = () => {
    if (!practitioner) return;
    const trimmed = reason.trim();
    if (trimmed.length < MIN_REASON_LENGTH) {
      setReasonError(`Give the practitioner a reason of at least ${MIN_REASON_LENGTH} characters.`);
      return;
    }
    setReasonError(null);
    review.mutate(
      { id: practitioner.id, decision: "rejected", reason: trimmed },
      { onSuccess: handleClose },
    );
  };

  return (
    <Drawer isOpen={isOpen} onClose={handleClose} labelledBy="practitioner-audit-title">
      <DrawerHeader
        eyebrow="Clinical Credential Audit"
        title={practitioner?.profiles.full_name ?? ""}
        titleId="practitioner-audit-title"
        onClose={handleClose}
      >
        <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
      </DrawerHeader>

      {practitioner && (
        <div className="flex-1 space-y-6 py-6">
          <div className="grid grid-cols-2 gap-5">
            <Field label="NMC / IDA Registration">
              <span className="font-mono">{practitioner.registration_number}</span>
            </Field>
            <Field label="Slot Fee">
              <span className="font-mono tabular-nums font-semibold">{formatInr(practitioner.consultation_fee_inr)}</span>
            </Field>
            <Field label="Qualifications">{practitioner.qualification}</Field>
            <Field label="Slot Duration">
              <span className="font-mono">{practitioner.slot_duration_minutes} mins</span>
            </Field>
            <Field label="Phone">
              <span className="font-mono">{practitioner.profiles.phone ?? "Not on file"}</span>
            </Field>
            <Field label="Role">
              <span className="capitalize">{practitioner.profiles.role}</span>
            </Field>
          </div>

          <Field label="Bio">
            {practitioner.bio ? (
              <p className="leading-relaxed text-text-secondary">{practitioner.bio}</p>
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

          {practitioner.rejection_reason && (
            <div className="rounded-2xl border border-accent-red/30 bg-accent-red/10 px-4 py-3 space-y-1">
              <p className="text-xs font-mono uppercase tracking-wider text-accent-red">Last rejection reason</p>
              <p className="text-sm text-text-primary">{practitioner.rejection_reason}</p>
            </div>
          )}

          {isRejecting && (
            <div className="space-y-2">
              <label htmlFor="rejection-reason" className={LABEL}>
                Reason for revision
              </label>
              <textarea
                id="rejection-reason"
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Registration certificate is illegible. Please re-upload a clear scan."
                className={cn(INPUT, "resize-none")}
              />
              {reasonError && <p className={ERROR_TEXT}>{reasonError}</p>}
            </div>
          )}

          {review.isError && <div className={ERROR_BOX}>{review.error.message}</div>}
        </div>
      )}

      <footer className="flex flex-col gap-3 pt-6 border-t border-aura-line">
        {isRejecting ? (
          <>
            <button type="button" onClick={handleRejectSubmit} disabled={review.isPending} className={BTN_DANGER_BLOCK}>
              {review.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Send for Revision
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRejecting(false);
                setReasonError(null);
              }}
              className={BTN_SECONDARY_BLOCK}
            >
              Back
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={handleVerify} disabled={review.isPending || !practitioner} className={BTN_PRIMARY_BLOCK}>
              {review.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Verify Practitioner
            </button>
            <button
              type="button"
              onClick={() => setIsRejecting(true)}
              disabled={review.isPending || !practitioner}
              className={BTN_OUTLINE_DANGER_BLOCK}
            >
              <XCircle className="w-4 h-4" />
              Reject / Request Revision
            </button>
          </>
        )}
      </footer>
    </Drawer>
  );
}
