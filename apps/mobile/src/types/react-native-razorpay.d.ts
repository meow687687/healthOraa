// react-native-razorpay ships no TypeScript declarations. These cover the subset the app uses.
declare module 'react-native-razorpay' {
  export interface RazorpaySuccess {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }

  export interface RazorpayError {
    code: number;
    description: string;
  }

  export interface RazorpayCheckoutOptions {
    key: string;
    amount: number;
    currency: string;
    order_id: string;
    name: string;
    description: string;
    theme?: { color: string };
    prefill?: { email?: string; contact?: string };
  }

  const RazorpayCheckout: {
    open(options: RazorpayCheckoutOptions): Promise<RazorpaySuccess>;
  };

  export default RazorpayCheckout;
}
