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
  refund_review: Pick<
    PaymentRefundReview,
    "gateway_payment_id" | "refund_id" | "automatic_refund_state" | "status" | "reason" | "created_at" | "resolved_at"
  > | null;
};

type RefundReviewSummary = PaymentWithCustomer["refund_review"];

export const paymentKeys = {
  all: ["payments"] as const,
  list: () => [...paymentKeys.all, "list"] as const,
};

const PAYMENT_PAGE_SIZE = 500;
const REFUND_LOOKUP_BATCH_SIZE = 100;

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
      const paymentRows: PaymentRow[] = [];
      let cursor: Pick<PaymentRow, "created_at" | "id"> | null = null;
      for (;;) {
        let pageQuery = supabase
          .from("payment_transactions")
          .select(
            `*,
            orders:orders!payment_transactions_order_id_fkey(id, profiles!orders_customer_id_fkey(full_name)),
            consultations:consultations!payment_transactions_consultation_id_fkey(id, profiles!consultations_patient_id_fkey(full_name))`,
          )
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .limit(PAYMENT_PAGE_SIZE);

        if (cursor) {
          pageQuery = pageQuery.or(
            `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.gt.${cursor.id})`,
          );
        }

        const { data, error } = await pageQuery;
        if (error) throw new Error(error.message);
        const page = (data ?? []) as PaymentRow[];
        paymentRows.push(...page);
        if (page.length < PAYMENT_PAGE_SIZE) break;
        const last = page[page.length - 1];
        cursor = { created_at: last.created_at, id: last.id };
      }

      const paymentIds = paymentRows
        .map((row) => row.gateway_payment_id)
        .filter((id): id is string => id !== null);
      const refundReviews: Array<NonNullable<RefundReviewSummary>> = [];
      for (let start = 0; start < paymentIds.length; start += REFUND_LOOKUP_BATCH_SIZE) {
        const batch = paymentIds.slice(start, start + REFUND_LOOKUP_BATCH_SIZE);
        const { data, error } = await supabase
          .from("payment_refund_reviews")
          .select("gateway_payment_id,refund_id,automatic_refund_state,status,reason,created_at,resolved_at")
          .in("gateway_payment_id", batch)
          .order("gateway_payment_id", { ascending: true })
          .range(0, batch.length - 1);
        if (error) throw new Error(error.message);
        refundReviews.push(...(data ?? []));
      }
      const reviewByPaymentId = new Map<string, RefundReviewSummary>(
        refundReviews.map((review) => [review.gateway_payment_id, review]),
      );
      return paymentRows.map((row) =>
        toPaymentWithCustomer(
          row,
          row.gateway_payment_id ? reviewByPaymentId.get(row.gateway_payment_id) ?? null : null,
        )
      );
    },
  });
};
