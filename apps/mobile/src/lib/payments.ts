import { Alert } from 'react-native';
import { supabase } from './supabase';
import { functionErrorMessage } from './functionError';

// Checkout for bookings, programmes and shop orders.
//
// The amount is set by the server (create-razorpay-order), never by the app. Razorpay reports the payment to
// razorpay-webhook, and that webhook is what confirms the booking, enrolment or order. The app only shows that
// the payment was submitted. Nothing on the device marks anything as paid.

export type PayableEntity = 'consultation' | 'program' | 'shop_order';

export type CheckoutOutcome =
  | { status: 'submitted' }
  | { status: 'cancelled' }
  | { status: 'not-configured' }
  | { status: 'failed'; message: string };

interface CreatedOrder {
  order_id: string;
  amount_paise: number;
  currency: string;
  key_id: string;
}

const PUBLIC_KEY_ID = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID;

// Loaded only when a payment starts. The native module exists in development and production builds, not in
// every runtime, so a plain import could stop the whole app from starting.
function loadRazorpayCheckout(): { open: (options: Record<string, unknown>) => Promise<unknown> } | null {
  try {
    const loaded = require('react-native-razorpay') as { default?: unknown };
    return (loaded.default ?? loaded) as { open: (options: Record<string, unknown>) => Promise<unknown> };
  } catch {
    return null;
  }
}

export async function startCheckout(input: {
  entityType: PayableEntity;
  entityId: string;
  description: string;
}): Promise<CheckoutOutcome> {
  if (!PUBLIC_KEY_ID) {
    Alert.alert(
      'Payments are not set up yet',
      'Online payment is not enabled in this build. Your booking or order is saved and will be paid once payments are switched on.',
    );
    return { status: 'not-configured' };
  }

  const checkout = loadRazorpayCheckout();
  if (!checkout) {
    Alert.alert('Checkout unavailable', 'This build does not include the Razorpay checkout. Use a development build to pay.');
    return { status: 'not-configured' };
  }

  const { data, error } = await supabase.functions.invoke<CreatedOrder>('create-razorpay-order', {
    body: { entity_type: input.entityType, entity_id: input.entityId },
  });
  if (error || !data) {
    return { status: 'failed', message: await functionErrorMessage(error, 'The payment could not be started. Try again.') };
  }

  try {
    await checkout.open({
      key: data.key_id,
      amount: data.amount_paise,
      currency: data.currency,
      order_id: data.order_id,
      name: 'Healthoraa',
      description: input.description,
      theme: { color: '#2B7FFF' },
    });
    return { status: 'submitted' };
  } catch (cause) {
    const reason = cause as { code?: number; description?: string };
    if (reason.code === 0 || /cancel/i.test(reason.description ?? '')) return { status: 'cancelled' };
    return { status: 'failed', message: reason.description ?? 'The payment did not complete. Try again.' };
  }
}
