// mygf/src/admin/features/reviews/Reviews.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../admin/auth/store";
import { useNavigate } from "react-router-dom";

type Role = "superadmin" | "admin" | "vendor" | "student" | "orguser" | string;

// --- Types that match the backend payloads ---
type ReviewItem = {
  id: string;
  rating: number;               // 1..5
  comment: string;
  status: "visible" | "hidden" | "pending";
  courseId: string;
  courseTitle: string;
  courseSlug?: string | null;
  orgId?: string | null;
  orgName?: string | null;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  createdAt: string;            // ISO
};

type PagedReviews = {
  rows: ReviewItem[];
  total: number;
  page: number;
  pageSize: number;
};

type CourseSummary = {
  courseId: string;
  courseTitle: string;
  orgId?: string | null;
  orgName?: string | null;
  count: number;
  avgRating: number;
};

type ReviewsSummary = {
  courses: CourseSummary[];
  overall: { count: number; avgRating: number };
  orgs?: Array<{ orgId: string; orgName: string; count: number }> | null; // superadmin only
};

const cx = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(" ");

// --- Small UI atoms ---
function Stars({ value }: { value: number }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {Array.from({ length: full }).map((_, i) => (
        <i key={`f${i}`} className="fa-solid fa-star text-amber-400" />
      ))}
      {half === 1 && <i className="fa-solid fa-star-half-stroke text-amber-400" />}
      {Array.from({ length: empty }).map((_, i) => (
        <i key={`e${i}`} className="fa-regular fa-star text-amber-300" />
      ))}
    </div>
  );
}

// --- Fetch helpers ---
async function apiGET<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiPATCH<T>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiDELETE<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "DELETE", credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Dashboard route prefix helper
function dashPrefix(role: Role) {
  const r = String(role || "").toLowerCase();
  if (r === "superadmin") return "/superadmin";
  if (r === "admin") return "/admin";
  if (r === "vendor") return "/vendor";
  return "/dashboard";
}

export default function Reviews() {
  const navigate = useNavigate();

  // Auth & role context (loosen typing to avoid TS complaint about _id)
  const me = useAuth((s) => s.user) as any;
  const role = (me?.role || "orguser") as Role; // orguser is your student role
  const userId = me?.id || me?._id || null;
  const orgIdFromAuth = me?.orgId || me?.org?._id || null;

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [courseId, setCourseId] = useState<string | "">("");
  const [orgId, setOrgId] = useState<string | "">(orgIdFromAuth || "");
  const [minStars, setMinStars] = useState<number>(0);
  const [status, setStatus] = useState<"any" | "visible" | "hidden" | "pending">("any");
  const [q, setQ] = useState(""); // search across comment/user/course
  const [sort, setSort] = useState<"new" | "old" | "high" | "low">("new");

  // Paging
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Data
  const [summary, setSummary] = useState<ReviewsSummary | null>(null);
  const [pageData, setPageData] = useState<PagedReviews>({
    rows: [],
    page: 1,
    pageSize,
    total: 0,
  });

  // Derived flags
  const isSuper = role === "superadmin";
  const isReadOnly = !isSuper; // admin & vendor are readonly

  // Build query string
  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    p.set("sort", sort); // "new|old|high|low"
    if (q) p.set("q", q);
    if (courseId) p.set("courseId", courseId);
    if (isSuper && orgId) p.set("orgId", orgId); // superadmin can cross-org
    if (!isSuper) p.set("scope", "auto");        // admin/vendor -> server infers org/owner
    if (minStars > 0) p.set("minStars", String(minStars));
    if (status !== "any") p.set("status", status);
    return p.toString();
  }, [page, pageSize, sort, q, courseId, orgId, isSuper, minStars, status]);

  // Load summary (avg, counts, course list)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setError(null);
        const qs = new URLSearchParams();
        if (isSuper && orgId) qs.set("orgId", orgId);
        if (!isSuper) qs.set("scope", "auto");
        const data = await apiGET<ReviewsSummary>(`/api/admin/reviews/summary?${qs.toString()}`);
        if (alive) setSummary(data);
      } catch (e: any) {
        if (alive) setError(e?.message || "Failed to load summary");
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuper, orgId]);

  // Load paged reviews
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiGET<PagedReviews>(`/api/admin/reviews?${query}`);
        if (alive) setPageData(data);
      } catch (e: any) {
        if (alive) setError(e?.message || "Failed to load reviews");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [query]);

  // Helpers
  const resetAndReload = () => setPage(1);

  const toggleVisibility = async (r: ReviewItem) => {
    if (!isSuper) return;
    const next = r.status === "visible" ? "hidden" : "visible";
    await apiPATCH(`/api/admin/reviews/${r.id}`, { status: next });
    setPageData((prev) => ({
      ...prev,
      rows: prev.rows.map((row) => (row.id === r.id ? { ...row, status: next } : row)),
    }));
  };

  const deleteReview = async (r: ReviewItem) => {
    if (!isSuper) return;
    if (!confirm("Delete this review permanently?")) return;
    await apiDELETE(`/api/admin/reviews/${r.id}`);
    setPageData((prev) => ({ ...prev, rows: prev.rows.filter((x) => x.id !== r.id), total: prev.total - 1 }));
    try {
      const qs = new URLSearchParams();
      if (isSuper && orgId) qs.set("orgId", orgId);
      if (!isSuper) qs.set("scope", "auto");
      const s = await apiGET<ReviewsSummary>(`/api/admin/reviews/summary?${qs.toString()}`);
      setSummary(s);
    } catch {}
  };

  const courseOptions = summary?.courses || [];

  const goToCourseInDashboard = (cid: string) => {
    const base = dashPrefix(role);
    // route to the dashboard courses sidebar (list) and hint selection
    navigate(`${base}/courses?select=${encodeURIComponent(cid)}`, {
      state: { selectCourseId: cid, from: "reviews" },
    });
  };

  return (
    <div className="w-full">
      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-r from-pink-500 to-blue-500 text-white w-12 h-12 rounded-xl flex items-center justify-center shadow">
              <i className="fa-solid fa-star text-xl" />
            </div>
            <div>
              <div className="text-sm text-gray-600">Overall Rating</div>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold text-gray-900">
                  {summary ? (Math.round((summary.overall.avgRating || 0) * 10) / 10).toFixed(1) : "–"}
                </div>
                <Stars value={summary?.overall.avgRating || 0} />
                <div className="text-sm text-gray-500">({summary?.overall.count || 0} reviews)</div>
              </div>
            </div>
          </div>

          {/* Filters row */}
          <div className="flex items-center gap-3 flex-wrap">
            {role === "superadmin" && (
              <div className="w-full sm:w-48">
                <label className="block text-xs text-gray-500 mb-1">Organization</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300"
                  value={orgId}
                  onChange={(e) => {
                    setOrgId(e.target.value);
                    setCourseId("");
                    resetAndReload();
                  }}
                >
                  <option value="">All Orgs</option>
                  {summary?.orgs?.map((o) => (
                    <option key={o.orgId} value={o.orgId}>
                      {o.orgName} ({o.count})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="w-full sm:w-56">
              <label className="block text-xs text-gray-500 mb-1">Course</label>
              <select
                value={courseId}
                onChange={(e) => {
                  setCourseId(e.target.value);
                  resetAndReload();
                }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300"
              >
                <option value="">All Courses</option>
                {courseOptions.map((c) => (
                  <option key={c.courseId} value={c.courseId}>
                    {c.courseTitle} ({c.count})
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full sm:w-36">
              <label className="block text-xs text-gray-500 mb-1">Min Stars</label>
              <select
                value={minStars}
                onChange={(e) => {
                  setMinStars(Number(e.target.value));
                  resetAndReload();
                }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300"
              >
                <option value={0}>All</option>
                <option value={5}>5★</option>
                <option value={4}>4★+</option>
                <option value={3}>3★+</option>
                <option value={2}>2★+</option>
                <option value={1}>1★+</option>
              </select>
            </div>

            <div className="w-full sm:w-36">
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as any);
                  resetAndReload();
                }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300"
                disabled={isReadOnly}
                title={isReadOnly ? "Only superadmin can filter by moderation state" : ""}
              >
                <option value="any">Any</option>
                <option value="visible">Visible</option>
                <option value="hidden">Hidden</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            <div className="w-full sm:w-56">
              <label className="block text-xs text-gray-500 mb-1">Search</label>
              <div className="relative">
                <i className="fa-solid fa-magnifying-glass text-gray-400 absolute left-3 top-2.5" />
                <input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search comment, course, user..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300"
                />
              </div>
            </div>

            <div className="w-full sm:w-40">
              <label className="block text-xs text-gray-500 mb-1">Sort</label>
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as any);
                  setPage(1);
                }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300"
              >
                <option value="new">Newest</option>
                <option value="old">Oldest</option>
                <option value="high">Highest Rated</option>
                <option value="low">Lowest Rated</option>
              </select>
            </div>
          </div>
        </div>

        {/* Quick courses (chips) */}
        {courseOptions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {courseOptions.slice(0, 12).map((c) => (
              <button
                key={c.courseId}
                onClick={() => {
                  setCourseId(c.courseId === courseId ? "" : c.courseId);
                  resetAndReload();
                }}
                className={cx(
                  "px-3 py-1 text-sm rounded-full border",
                  courseId === c.courseId
                    ? "bg-gradient-to-r from-pink-500 to-blue-500 text-white border-transparent"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-pink-50"
                )}
              >
                {c.courseTitle} • {c.count}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Reviews List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        {loading && pageData.rows.length === 0 && (
          <div className="p-8 text-center text-gray-500">Loading reviews…</div>
        )}
        {error && <div className="p-4 text-red-600">{error}</div>}
        {!loading && pageData.rows.length === 0 && !error && (
          <div className="p-8 text-center text-gray-500">No reviews found.</div>
        )}

        <ul className="divide-y divide-gray-100">
          {pageData.rows.map((r) => {
            const avatarLetter = (r.userName || r.userEmail || "U").slice(0, 1).toUpperCase();
            const displayName = r.userName || r.userEmail || "User";
            return (
              <li key={r.id} className="p-4 sm:p-5 hover:bg-gray-50/60 transition">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-pink-400 to-blue-400 text-white flex items-center justify-center font-semibold shadow">
                    {avatarLetter}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <div className="font-semibold text-gray-900 truncate">{displayName}</div>
                      <Stars value={r.rating} />
                      <div
                        className={cx(
                          "text-xs px-2 py-1 rounded-full border",
                          r.status === "visible"
                            ? "border-green-200 text-green-700 bg-green-50"
                            : r.status === "hidden"
                            ? "border-amber-200 text-amber-700 bg-amber-50"
                            : "border-gray-200 text-gray-600 bg-gray-50"
                        )}
                      >
                        {r.status}
                      </div>
                      <div className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleString()}</div>
                    </div>

                    <div className="mt-1 text-gray-700 whitespace-pre-wrap">
                      {r.comment || <span className="text-gray-400 italic">No comment.</span>}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                      <span className="inline-flex items-center gap-1 text-gray-700">
                        <i className="fa-solid fa-book-open" /> {r.courseTitle}
                      </span>
                      {r.orgName && (
                        <span className="inline-flex items-center gap-1 text-gray-500">
                          <i className="fa-solid fa-building" /> {r.orgName}
                        </span>
                      )}
                      <button
                        className="inline-flex items-center gap-1 text-pink-600 hover:text-pink-700"
                        onClick={() => goToCourseInDashboard(r.courseId)}
                      >
                        <i className="fa-solid fa-arrow-up-right-from-square" />
                        View Course
                      </button>
                    </div>
                  </div>

                  {/* Actions (superadmin only) */}
                  {!isReadOnly && (
                    <div className="flex items-center gap-2 ml-2">
                      <button
                        onClick={() => toggleVisibility(r)}
                        className="rounded-lg px-3 py-2 border border-gray-200 hover:bg-gray-100 text-gray-700"
                        title={r.status === "visible" ? "Hide review" : "Show review"}
                      >
                        {r.status === "visible" ? (
                          <i className="fa-solid fa-eye-slash" />
                        ) : (
                          <i className="fa-solid fa-eye" />
                        )}
                      </button>
                      <button
                        onClick={() => deleteReview(r)}
                        className="rounded-lg px-3 py-2 border border-red-200 hover:bg-red-50 text-red-600"
                        title="Delete review"
                      >
                        <i className="fa-solid fa-trash" />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {/* Paging */}
        <div className="p-4 sm:p-5 flex items-center justify-between border-t border-gray-100">
          <div className="text-sm text-gray-600">
            {Math.min((page - 1) * pageSize + 1, Math.max(0, pageData.total))}–
            {Math.min(page * pageSize, pageData.total)} of {pageData.total}
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={cx(
                "px-3 py-2 rounded-lg border",
                page <= 1
                  ? "border-gray-200 text-gray-400 cursor-not-allowed"
                  : "border-gray-200 text-gray-700 hover:bg-gray-100"
              )}
            >
              <i className="fa-solid fa-chevron-left" />
            </button>
            <button
              disabled={page * pageSize >= pageData.total}
              onClick={() => setPage((p) => p + 1)}
              className={cx(
                "px-3 py-2 rounded-lg border",
                page * pageSize >= pageData.total
                  ? "border-gray-200 text-gray-400 cursor-not-allowed"
                  : "border-gray-200 text-gray-700 hover:bg-gray-100"
              )}
            >
              <i className="fa-solid fa-chevron-right" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
