import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import type { PaymentRefundReview, PaymentTransaction, Profile } from "@healthoraa/types";
import { watchTables } from "@healthoraa/ui";
import { supabase } from "../lib/supabase";

type CustomerRef = { profiles: Pick<Profile, "full_name"> | null } | null;

export type PaymentRow = PaymentTransaction & {
  orders: CustomerRef & { id: string };
  consultations: CustomerRef & { id: string };
};

export type PaymentWithCustomer = PaymentTransaction & {
  customer_name: string | null;
  linked_order_id: string | null;
  linked_consultation_id: string | null;
  refund_review: Pick<PaymentRefundReview, "status" | "reason" | "created_at" | "resolved_at"> | null;
};

type RefundReviewSummary = PaymentWithCustomer["refund_review"];

export const paymentKeys = {
  all: ["payments"] as const,
  list: () => [...paymentKeys.all, "list"] as const,
};

type RefundResolutionInput = { gatewayPaymentId: string; refundId: string };

export const useRecordPaymentRefundReview = (
  onSuccess?: () => void,
): UseMutationResult<void, Error, RefundResolutionInput> => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, RefundResolutionInput>({
    mutationFn: async ({ gatewayPaymentId, refundId }): Promise<void> => {
      const { error } = await supabase.rpc("record_payment_refund_review", {
        p_gateway_payment_id: gatewayPaymentId,
        p_refund_id: refundId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: paymentKeys.all });
      onSuccess?.();
    },
  });
};

const toPaymentWithCustomer = (
  row: PaymentRow,
  refundReview: RefundReviewSummary,
): PaymentWithCustomer => {
  const { orders, consultations, ...transaction } = row;
  return {
    ...transaction,
    customer_name:
      orders?.profiles?.full_name ?? consultations?.profiles?.full_name ?? null,
    linked_order_id: orders?.id ?? null,
    linked_consultation_id: consultations?.id ?? null,
    refund_review: refundReview,
  };
};

export const usePayments = () => {
  const queryClient = useQueryClient();

  // Realtime: new and updated payment transactions refresh the audit feed without a reload.
  useEffect(
    () =>
      watchTables(supabase, "admin-payments", [
        { table: "payment_transactions", events: ["INSERT", "UPDATE"] },
        { table: "payment_refund_reviews", events: ["INSERT", "UPDATE", "DELETE"] },
      ], () => {
        void queryClient.invalidateQueries({ queryKey: paymentKeys.all });
      }),
    [queryClient],
  );

  return useQuery<PaymentWithCustomer[], Error>({
    queryKey: paymentKeys.list(),
    queryFn: async (): Promise<PaymentWithCustomer[]> => {
      const { data, error } = await supabase
        .from("payment_transactions")
        .select(
          `*,
          orders:orders!payment_transactions_order_id_fkey(id, profiles!orders_customer_id_fkey(full_name)),
          consultations:consultations!payment_transactions_consultation_id_fkey(id, profiles!consultations_patient_id_fkey(full_name))`,
        )
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      const { data: refundReviews, error: refundReviewError } = await supabase
        .from("payment_refund_reviews")
        .select("gateway_payment_id,status,reason,created_at,resolved_at");
      if (refundReviewError) throw new Error(refundReviewError.message);
      const reviewByPaymentId = new Map<string, RefundReviewSummary>(
        (refundReviews ?? []).map(({ gateway_payment_id, ...review }) => [gateway_payment_id, review]),
      );
      return ((data ?? []) as PaymentRow[]).map((row) =>
        toPaymentWithCustomer(
          row,
          row.gateway_payment_id ? reviewByPaymentId.get(row.gateway_payment_id) ?? null : null,
        )
      );
    },
  });
};
