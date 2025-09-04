//mygf/src/types/payment.ts
export type PaymentStatus = "pending" | "submitted" | "verified" | "captured" | "failed" | "refunded" | "rejected";
export type PaymentType = "online" | "offline";

export interface Payment {
  id: string;
  type: PaymentType;
  method?: "razorpay" | "stripe" | "upi" | "cash" | "other";
  status: PaymentStatus;
  amount: number;             // paise
  currency: string;           // "INR"
  orgId: string;
  courseId: string;
  studentId?: string | null;
  receiptNo?: string | null;
  referenceId?: string | null;
  notes?: string | null;
  provider?: string | null;
  providerOrderId?: string | null;
  providerPaymentId?: string | null;
  submittedBy?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  managerId?: string | null;
  createdAt: string;
  updatedAt: string;
  studentEmail?: string | null;
  studentName?: string | null;
  courseTitle?: string | null;
}
