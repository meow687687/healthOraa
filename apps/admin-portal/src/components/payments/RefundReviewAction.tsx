import { useState, type FormEvent } from "react";
import type { PaymentRefundReview } from "@healthoraa/types";
import { useRecordPaymentRefundReference, useRetryAutomaticPaymentRefund } from "../../hooks/usePayments";

type RefundReviewActionProps = {
  review: Pick<
    PaymentRefundReview,
    | "gateway_payment_id"
    | "refund_id"
    | "automatic_refund_state"
    | "manual_refund_reference"
    | "manual_refund_recorded_by"
    | "manual_refund_recorded_at"
    | "status"
    | "reason"
  > | null;
};

export function RefundReviewAction({ review }: RefundReviewActionProps) {
  const [refundId, setRefundId] = useState("");
  const mutation = useRecordPaymentRefundReference();
  const retryMutation = useRetryAutomaticPaymentRefund();

  if (!review) return null;

  if (review.status === "resolved") {
    return (
      <div className="rounded-2xl border border-accent-emerald/30 bg-accent-emerald/10 px-4 py-3 space-y-1">
        <p className="text-xs font-mono uppercase tracking-wider text-accent-emerald">Refund confirmed by Razorpay</p>
        {review.refund_id && <p className="text-sm text-text-primary">Razorpay refund ID: {review.refund_id}</p>}
        <p className="text-xs text-text-muted">Processed refund events cover the captured payment amount.</p>
      </div>
    );
  }

  if (review.automatic_refund_state === "retryable") {
    return (
      <div className="space-y-3 rounded-2xl border border-accent-blue/30 bg-accent-blue/10 px-4 py-3">
        <p className="text-xs font-mono uppercase tracking-wider text-accent-blue">Automatic refund needs a retry</p>
        <p className="text-sm text-text-primary">{review.reason}</p>
        <p className="text-xs text-text-muted">
          Retry the same Razorpay request safely. Its idempotency key prevents a second refund if the first request reached Razorpay.
        </p>
        {retryMutation.isError && <p role="alert" className="text-sm text-accent-red">{retryMutation.error.message}</p>}
        <button
          type="button"
          onClick={() => retryMutation.mutate(review.gateway_payment_id)}
          disabled={retryMutation.isPending}
          className="min-h-11 rounded-xl bg-aura-s3 px-4 text-sm font-medium text-text-primary transition-opacity disabled:opacity-50"
        >
          {retryMutation.isPending ? "Checking with Razorpay…" : "Retry automatic refund"}
        </button>
      </div>
    );
  }

  if (review.automatic_refund_state === "pending") {
    return (
      <div className="space-y-3 rounded-2xl border border-accent-blue/30 bg-accent-blue/10 px-4 py-3">
        <p className="text-xs font-mono uppercase tracking-wider text-accent-blue">Refund processing</p>
        {review.refund_id && <p className="text-sm text-text-primary">Razorpay refund ID: {review.refund_id}</p>}
        <p className="text-sm text-text-primary">{review.reason}</p>
        <p className="text-xs text-text-muted">
          Check Razorpay directly if its refund webhook has not arrived. Processed provider events still determine when this review closes.
        </p>
        {retryMutation.isError && <p role="alert" className="text-sm text-accent-red">{retryMutation.error.message}</p>}
        {review.refund_id && (
          <button
            type="button"
            onClick={() => retryMutation.mutate(review.gateway_payment_id)}
            disabled={retryMutation.isPending}
            className="min-h-11 rounded-xl bg-aura-s3 px-4 text-sm font-medium text-text-primary transition-opacity disabled:opacity-50"
          >
            {retryMutation.isPending ? "Checking with Razorpay…" : "Check refund status"}
          </button>
        )}
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
        {review.refund_id && <p className="text-xs text-text-muted">Provider-reported refund ID: {review.refund_id}</p>}
        {review.manual_refund_reference && (
          <p className="text-xs text-text-muted">
            Admin reference {review.manual_refund_reference}
            {review.manual_refund_recorded_by ? ` recorded by ${review.manual_refund_recorded_by}` : " recorded"}
            {review.manual_refund_recorded_at ? ` at ${new Date(review.manual_refund_recorded_at).toLocaleString()}` : ""}.
            Awaiting Razorpay confirmation.
          </p>
        )}
        <p className="text-xs text-text-muted">
          Record the refund ID after issuing it in Razorpay. This reference does not close the review; processed refund events do.
        </p>
      </div>
      <div className="space-y-1">
        <label htmlFor="razorpay-refund-id" className="text-xs font-medium text-text-secondary">Razorpay refund reference</label>
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
        {mutation.isPending ? "Saving reference…" : "Record reference"}
      </button>
    </form>
  );
}
