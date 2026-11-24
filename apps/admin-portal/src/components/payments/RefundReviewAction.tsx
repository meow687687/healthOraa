import { useState, type FormEvent } from "react";
import type { PaymentRefundReview } from "@healthoraa/types";
import { useRecordPaymentRefundReview } from "../../hooks/usePayments";

type RefundReviewActionProps = {
  review: PaymentRefundReview | null;
  onResolved: () => void;
};

export function RefundReviewAction({ review, onResolved }: RefundReviewActionProps) {
  const [refundId, setRefundId] = useState("");
  const mutation = useRecordPaymentRefundReview(onResolved);

  if (!review) return null;

  if (review.status === "resolved") {
    return (
      <div className="rounded-2xl border border-accent-emerald/30 bg-accent-emerald/10 px-4 py-3 space-y-1">
        <p className="text-xs font-mono uppercase tracking-wider text-accent-emerald">Refund recorded</p>
        <p className="text-sm text-text-primary">Razorpay refund ID: {review.refund_id}</p>
      </div>
    );
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const value = refundId.trim();
    if (!value) return;
    mutation.mutate({ gatewayPaymentId: review.gateway_payment_id, refundId: value });
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-accent-amber/30 bg-accent-amber/10 px-4 py-3 space-y-3">
      <div className="space-y-1">
        <p className="text-xs font-mono uppercase tracking-wider text-accent-amber">Refund review required</p>
        <p className="text-sm text-text-primary">{review.reason}</p>
        <p className="text-xs text-text-muted">After issuing the refund in Razorpay, record its refund ID here.</p>
      </div>
      <div className="space-y-1">
        <label htmlFor="razorpay-refund-id" className="text-xs font-medium text-text-secondary">Razorpay refund ID</label>
        <input
          id="razorpay-refund-id"
          value={refundId}
          onChange={(event) => setRefundId(event.currentTarget.value)}
          autoComplete="off"
          required
          className="min-h-11 w-full rounded-xl border border-aura-line bg-aura-s1 px-3 text-sm text-text-primary outline-none focus:border-accent-amber"
        />
      </div>
      {mutation.isError && <p role="alert" className="text-sm text-accent-red">{mutation.error.message}</p>}
      <button
        type="submit"
        disabled={!refundId.trim() || mutation.isPending}
        className="min-h-11 rounded-xl bg-aura-s3 px-4 text-sm font-medium text-text-primary transition-opacity disabled:opacity-50"
      >
        {mutation.isPending ? "Saving refund ID…" : "Record refund ID"}
      </button>
    </form>
  );
}
