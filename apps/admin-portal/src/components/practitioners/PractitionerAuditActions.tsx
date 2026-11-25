import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import {
  BTN_DANGER_BLOCK,
  BTN_OUTLINE_DANGER_BLOCK,
  BTN_PRIMARY_BLOCK,
  BTN_SECONDARY_BLOCK,
} from "../ui/tokens";

interface PractitionerAuditActionsProps {
  isRejecting: boolean;
  isPending: boolean;
  isSeededDemo: boolean;
  onVerify: () => void;
  onStartReject: () => void;
  onCancelReject: () => void;
  onSubmitReject: () => void;
}

export function PractitionerAuditActions({
  isRejecting,
  isPending,
  isSeededDemo,
  onVerify,
  onStartReject,
  onCancelReject,
  onSubmitReject,
}: PractitionerAuditActionsProps) {
  return (
    <footer className="flex flex-col gap-3 pt-6 border-t border-aura-line">
      {isRejecting ? (
        <>
          <button
            type="button"
            onClick={onSubmitReject}
            disabled={isPending}
            className={BTN_DANGER_BLOCK}
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            Send for Revision
          </button>
          <button
            type="button"
            onClick={onCancelReject}
            className={BTN_SECONDARY_BLOCK}
          >
            Back
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={onVerify}
            disabled={isPending || isSeededDemo}
            className={isSeededDemo ? BTN_SECONDARY_BLOCK : BTN_PRIMARY_BLOCK}
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            {isSeededDemo ? "Sample status only" : "Verify Practitioner"}
          </button>
          <button
            type="button"
            onClick={onStartReject}
            disabled={isPending || isSeededDemo}
            className={BTN_OUTLINE_DANGER_BLOCK}
          >
            <XCircle className="w-4 h-4" />
            {isSeededDemo
              ? "Review actions disabled for sample"
              : "Reject / Request Revision"}
          </button>
        </>
      )}
    </footer>
  );
}
