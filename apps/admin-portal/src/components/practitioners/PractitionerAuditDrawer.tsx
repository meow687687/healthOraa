import { useState } from "react";
import { useReviewPractitioner } from "../../hooks/usePractitioners";
import type { PractitionerWithProfile } from "../../hooks/usePractitioners";
import { Drawer, DrawerHeader } from "../ui/Drawer";
import { Badge } from "../ui/Badge";
import { PractitionerAuditDetails } from "./PractitionerAuditDetails";
import { PractitionerAuditActions } from "./PractitionerAuditActions";
import { cn } from "../../lib/cn";
import { isSeededDemoPractitioner } from "../../lib/practitioners";
import { ERROR_BOX, ERROR_TEXT, INPUT, LABEL } from "../ui/tokens";
import type { Tone } from "../ui/tokens";

interface PractitionerAuditDrawerProps {
  practitioner: PractitionerWithProfile | null;
  onClose: () => void;
}

const MIN_REASON_LENGTH = 10;

const VERIFICATION_META: Record<
  PractitionerWithProfile["verification_status"],
  { label: string; tone: Tone }
> = {
  verified: { label: "Verified", tone: "emerald" },
  pending: { label: "Pending Review", tone: "amber" },
  rejected: { label: "Rejected", tone: "red" },
};

export default function PractitionerAuditDrawer({
  practitioner,
  onClose,
}: PractitionerAuditDrawerProps) {
  const [isRejecting, setIsRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const review = useReviewPractitioner();

  const isOpen = practitioner !== null;
  const status = practitioner?.verification_status ?? "pending";
  const statusMeta = VERIFICATION_META[status];
  const isSeededDemo = isSeededDemoPractitioner(practitioner?.id);

  const handleClose = () => {
    setIsRejecting(false);
    setReason("");
    setReasonError(null);
    review.reset();
    onClose();
  };

  const handleVerify = () => {
    if (!practitioner) return;
    review.mutate(
      { id: practitioner.id, decision: "verified" },
      { onSuccess: handleClose },
    );
  };

  const handleRejectSubmit = () => {
    if (!practitioner) return;
    const trimmed = reason.trim();
    if (trimmed.length < MIN_REASON_LENGTH) {
      setReasonError(
        `Give the practitioner a reason of at least ${MIN_REASON_LENGTH} characters.`,
      );
      return;
    }
    setReasonError(null);
    review.mutate(
      { id: practitioner.id, decision: "rejected", reason: trimmed },
      { onSuccess: handleClose },
    );
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      labelledBy="practitioner-audit-title"
    >
      <DrawerHeader
        eyebrow="Clinical Credential Audit"
        title={practitioner?.profiles.full_name ?? ""}
        titleId="practitioner-audit-title"
        onClose={handleClose}
      >
        <Badge tone={isSeededDemo ? "violet" : statusMeta.tone}>
          {isSeededDemo ? "Demo · not audited" : statusMeta.label}
        </Badge>
      </DrawerHeader>

      {practitioner && (
        <div className="flex-1 space-y-6 py-6">
          <PractitionerAuditDetails
            practitioner={practitioner}
            isSeededDemo={isSeededDemo}
          />

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

          {review.isError && (
            <div className={ERROR_BOX}>{review.error.message}</div>
          )}
        </div>
      )}

      <PractitionerAuditActions
        isRejecting={isRejecting}
        isPending={review.isPending}
        isSeededDemo={isSeededDemo}
        onVerify={handleVerify}
        onStartReject={() => setIsRejecting(true)}
        onCancelReject={() => {
          setIsRejecting(false);
          setReasonError(null);
        }}
        onSubmitReject={handleRejectSubmit}
      />
    </Drawer>
  );
}
