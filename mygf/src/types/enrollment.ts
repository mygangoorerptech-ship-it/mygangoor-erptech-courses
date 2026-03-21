//src/types/enrollment.ts
export type EnrollmentStatus = "free" | "premium" | "trial" | "revoked";

export interface Enrollment {
  id: string;
  studentId: string;
  courseId: string;
  orgId: string;
  status: EnrollmentStatus;
  source: "online" | "offline" | "admin" | "teacher" | "claim";
  paymentId?: string | null;
  managerId?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Phase 5 — paginated shape returned by GET /enrollments/org after M-3 backend fix.
 * The old format was Enrollment[]; the new format is EnrollmentListPage.
 * listOrgEnrollments() normalizes both to Enrollment[] transparently.
 */
export interface EnrollmentListPage {
  items: Enrollment[];
  total: number;
  page: number;
  pageSize: number;
}
