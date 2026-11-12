import { PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

export interface WebhookResult {
  status: number;
  body: Record<string, unknown>;
}

// Sends a Razorpay-shaped `payment.captured` event to the razorpay-webhook Edge Function.
// The function accepts it unsigned only when ALLOW_MOCK_WEBHOOK=true on a local URL.
export const sendPaymentCaptured = async (input: {
  orderId: string;
  amountPaise: number;
  currency: string;
  paymentId: string;
}): Promise<WebhookResult> => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/razorpay-webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: PUBLISHABLE_KEY },
    body: JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: input.paymentId,
            order_id: input.orderId,
            amount: input.amountPaise,
            currency: input.currency,
            status: "captured",
          },
        },
      },
    }),
  });
  const body = (await response.json()) as Record<string, unknown>;
  return { status: response.status, body };
};

export const webhookReady = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/razorpay-webhook`, {
      method: "OPTIONS",
      headers: { apikey: PUBLISHABLE_KEY },
    });
    return response.status === 200;
  } catch {
    return false;
  }
};
