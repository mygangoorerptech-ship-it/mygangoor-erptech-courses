//frontend/src/types/global.d.ts
// global Razorpay type (minimal)
interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name?: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, any>;
  method: { upi: true, netbanking: true, card: true, wallet: true, paylater: true },
  handler?: (resp: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  modal?: { ondismiss?: () => void };
}
interface RazorpayInstance { open(): void }
interface RazorpayCtor { new (opts: RazorpayOptions): RazorpayInstance }
declare var Razorpay: RazorpayCtor;
