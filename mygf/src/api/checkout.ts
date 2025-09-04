// src/api/checkout.ts
import { api } from "./client";

export async function rzpCreateOrder(payload: {
  courseId: string;
  orgId: string;
  discountKind?: "none" | "coupon" | "refer";
  couponCode?: string;
  mode?: "full" | "part";
  partAmount?: number; // rupees
}) {
  const { data } = await api.post("/checkout/razorpay/order", payload);
  return data as { ok: boolean; key: string; orderId: string; amount: number; currency: string };
}

export async function rzpVerifyPayment(payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  courseId: string;
  orgId: string;
  joinForm?: any; // persisted server-side into Payment.notes
}) {
  const { data } = await api.post("/checkout/razorpay/verify", payload);
  return data as { ok: boolean };
}

export async function rzpReceipt(orderId: string) {
  // add leading slash for consistency
  const { data } = await api.get(`/checkout/razorpay/receipt/${orderId}`, { withCredentials: true });
  return data; // { ok, receipt }
}

