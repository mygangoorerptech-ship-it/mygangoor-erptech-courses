//src/types/enrollment.ts
export type EnrollmentStatus = "free" | "premium" | "trial" | "revoked";

export interface Enrollment {
  id: string;
  studentId: string;
  courseId: string;
  orgId: string;
  status: EnrollmentStatus;
  source: "online" | "offline" | "admin" | "vendor" | "claim";
  paymentId?: string | null;
  managerId?: string | null;
  createdAt: string;
  updatedAt: string;
}
