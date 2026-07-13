// src/teacher/pages/teacher/Students.tsx
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../api/client";
import { useAuth } from "../../auth/store";
import Modal from "../../components/Modal";
import { getUserDetails } from "../../../api/students";
import { Eye, Loader2, Mail, Phone, MapPin, Calendar } from "lucide-react";
import toast from "react-hot-toast";

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

const PAGE_SIZE = 20;

export default function VEStudents() {
  const { user } = useAuth() as any;
  const [page, setPage] = useState(1);
  const [courseFilter, setCourseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewStudentId, setViewStudentId] = useState<string | null>(null);

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
                  <th className="px-4 py-3">Completion</th>
                  <th className="px-4 py-3">Enrolled</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {items.map((s) => {
                  const isCompleted = s.overallStatus === "completed";

                  return (
                    <tr key={s.enrollmentId} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{s.studentName || "-"}</div>
                        <div className="text-xs text-slate-500">{s.studentEmail || "-"}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{s.courseTitle || s.courseId}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.enrollmentStatus === "premium"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : s.enrollmentStatus === "revoked"
                              ? "bg-red-50 text-red-700 border border-red-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}>
                          {s.enrollmentStatus}
                        </span>
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
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setViewStudentId(s.studentId)}
                            className="rounded p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                            title="View student details"
                          >
                            <Eye size={14} />
                          </button>
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
                              <span className="text-xs text-slate-400">
                                Certificate pending
                              </span>
                            )
                          ) : (
                            <span className="text-xs text-slate-400">
                              Not completed
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-slate-800">
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

      {viewStudentId && (
        <StudentDetailsModal
          userId={viewStudentId}
          onClose={() => setViewStudentId(null)}
        />
      )}
    </div>
  );
}

type StudentDetailResponse = {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    orgId?: string | null;
    createdAt?: string | null;
  } | null;
  formProfile: {
    fullName?: string;
    mobile?: string;
    gender?: string;
    age?: number | string;
    birth?: string;
    address?: string;
  } | null;
} | null;

function StudentDetailsModal({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StudentDetailResponse>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        const res = await getUserDetails(userId);
        if (mounted) setData(res);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load student details");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [userId]);

  const user = data?.user;
  const profile = data?.formProfile;

  return (
    <Modal open onClose={onClose} title="Student Details">
      <div className="max-h-[80vh] overflow-y-auto">
        {loading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="animate-spin" size={28} />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl border p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    {user?.name || "—"}
                  </h2>
                  <div className="mt-2 space-y-2 text-sm text-slate-800">
                    <div className="flex items-center gap-2">
                      <Mail size={16} />
                      {user?.email || "—"}
                    </div>
                    {profile?.mobile && (
                      <div className="flex items-center gap-2">
                        <Phone size={16} />
                        {profile.mobile}
                      </div>
                    )}
                    {profile?.address && (
                      <div className="flex items-center gap-2">
                        <MapPin size={16} />
                        {profile.address}
                      </div>
                    )}
                    {user?.createdAt && (
                      <div className="flex items-center gap-2">
                        <Calendar size={16} />
                        {new Date(user.createdAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 rounded bg-slate-100 text-sm">
                    {user?.role || "—"}
                  </span>
                  <span
                    className={
                      user?.status === "active"
                        ? "px-2 py-1 rounded bg-green-100 text-green-700 text-sm"
                        : "px-2 py-1 rounded bg-red-100 text-red-700 text-sm"
                    }
                  >
                    {user?.status || "—"}
                  </span>
                </div>
              </div>
            </div>

            {(user?.role === "student" || user?.role === "orguser") && profile && (
              <div className="rounded-xl border p-4">
                <h3 className="font-semibold text-slate-900 mb-4">
                  Student Form Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-slate-500">Full Name</div>
                    <div className="font-medium">{profile?.fullName || "—"}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Mobile</div>
                    <div className="font-medium">{profile?.mobile || "—"}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Gender</div>
                    <div className="font-medium">{profile?.gender || "—"}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Age</div>
                    <div className="font-medium">{profile?.age || "—"}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Birth</div>
                    <div className="font-medium">{profile?.birth || "—"}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-slate-500">Address</div>
                    <div className="font-medium">{profile?.address || "—"}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
