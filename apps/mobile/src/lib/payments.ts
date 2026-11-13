// Checkout boundary for consultations and shop orders.
//
// Razorpay's native checkout needs the react-native-razorpay native module, the public key id and a
// development build, none of which this build includes yet. Until it is linked, no code on the device marks an
// order or booking as paid. The server order stays pending until the signed Razorpay webhook confirms payment.

export interface CheckoutRequest {
  orderId: string;
  amountPaise: number;
  description: string;
}

export interface CheckoutResult {
  status: 'pending-verification';
  orderId: string;
}

export async function startCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
  return { status: 'pending-verification', orderId: request.orderId };
}
