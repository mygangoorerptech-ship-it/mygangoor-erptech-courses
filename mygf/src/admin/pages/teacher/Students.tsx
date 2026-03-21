// src/admin/pages/teacher/Students.tsx
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../api/client";
import { useAuth } from "../../auth/store";

type TeacherStudent = {
  enrollmentId: string;
  studentId: string;
  studentName: string | null;
  studentEmail: string | null;
  courseId: string;
  courseTitle: string | null;
  enrollmentStatus: string;
  enrolledAt: string;
  progressPercent?: number | null;
  overallStatus?: string | null;
  certificateUrl?: string | null;
};

type StudentsResponse = {
  items: TeacherStudent[];
  total: number;
};

async function fetchStudents(params: {
  courseId?: string;
  status?: string;
  page: number;
  limit: number;
}): Promise<StudentsResponse> {
  const res = await api.get("/teacher/students", { params, withCredentials: true });
  const data = res.data;
  if (Array.isArray(data)) return { items: data, total: data.length };
  return data as StudentsResponse;
}

async function markComplete(studentId: string, courseId: string) {
  const res = await api.post(
    `/teacher/students/${studentId}/courses/${courseId}/complete`,
    {},
    { withCredentials: true }
  );
  return res.data as { ok: boolean; overallStatus: string; certificateUrl: string | null };
}

const PAGE_SIZE = 20;

export default function VEStudents() {
  const { user } = useAuth() as any;
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [courseFilter, setCourseFilter] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");

  const query = useQuery<StudentsResponse>({
    queryKey: ["teacher:students", { courseFilter, statusFilter, page }],
    queryFn: () =>
      fetchStudents({
        courseId: courseFilter || undefined,
        status: statusFilter || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    enabled: !!user,
    retry: false,
  });

  const completeMutation = useMutation({
    mutationFn: ({ studentId, courseId }: { studentId: string; courseId: string }) =>
      markComplete(studentId, courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher:students"] });
    },
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Students</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Students enrolled in courses assigned to you.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={courseFilter}
          onChange={(e) => { setCourseFilter(e.target.value); setPage(1); }}
          placeholder="Filter by course ID"
          className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300 w-52"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">All statuses</option>
          <option value="premium">Premium</option>
          <option value="free">Free</option>
          <option value="trial">Trial</option>
          <option value="revoked">Revoked</option>
        </select>
      </div>

      {/* States */}
      {query.isLoading && (
        <div className="py-16 text-center text-sm text-slate-500">Loading students…</div>
      )}

      {query.isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          Failed to load students. Please refresh and try again.
        </div>
      )}

      {completeMutation.isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          Failed to mark completion. Please try again.
        </div>
      )}

      {/* Table */}
      {query.isSuccess && items.length === 0 && (
        <div className="py-16 text-center text-sm text-slate-400">No students found.</div>
      )}

      {query.isSuccess && items.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Progress</th>
                  <th className="px-4 py-3">Completion</th>
                  <th className="px-4 py-3">Enrolled</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {items.map((s) => {
                  const isCompleted = s.overallStatus === "completed";
                  const isMarking =
                    completeMutation.isPending &&
                    (completeMutation.variables as any)?.studentId === s.studentId &&
                    (completeMutation.variables as any)?.courseId === s.courseId;

                  return (
                    <tr key={s.enrollmentId} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{s.studentName || "-"}</div>
                        <div className="text-xs text-slate-500">{s.studentEmail || "-"}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{s.courseTitle || s.courseId}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          s.enrollmentStatus === "premium"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : s.enrollmentStatus === "revoked"
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}>
                          {s.enrollmentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {s.progressPercent != null ? `${s.progressPercent}%` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ✓ Completed
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {s.enrolledAt ? new Date(s.enrolledAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {isCompleted ? (
                          s.certificateUrl ? (
                            <a
                              href={s.certificateUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-indigo-600 hover:underline"
                            >
                              View Certificate
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400">Certificate pending</span>
                          )
                        ) : (
                          <button
                            disabled={isMarking || s.enrollmentStatus === "revoked"}
                            onClick={() =>
                              completeMutation.mutate({
                                studentId: s.studentId,
                                courseId: s.courseId,
                              })
                            }
                            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {isMarking ? "Marking…" : "Mark Complete"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>{total} student{total !== 1 ? "s" : ""}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg border bg-white hover:bg-slate-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-xs text-slate-500">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg border bg-white hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
