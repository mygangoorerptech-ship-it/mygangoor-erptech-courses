// mygf/src/components/dashboard/ProfileInfoCard.tsx
import { useEffect, useState } from "react";
import Card from "./ui/Card";
import { api } from "../../api/client";

type Props = {
  initials: string;
  name: string;
  handle: string;
  statusBadges: { text: string; bg: string; textColor: string }[];
  dob: string;
  registrationDate: string;
  paymentStatus: "Paid" | "Unpaid"; // kept for compatibility, not displayed anymore
  accountStatus: "Active" | "Suspended";
};

type EnrolledCourse = {
  courseId: string;
  orgId?: string;
  title: string;
  slug?: string | null;
  enrolledAt?: string;
};

export default function ProfileInfoCard({
  initials,
  name,
  handle,
  statusBadges,
  dob,
  registrationDate,
  // paymentStatus,  // not used (replaced by Courses Enrolled)
  accountStatus,
}: Props) {
  // Enrollment UI state
  const [courses, setCourses] = useState<EnrolledCourse[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  // Prefetch once so we know whether to show the arrow
  useEffect(() => {
    let done = false;
    (async () => {
      try {
        const r = await api.get("/student/enrollments/active", { withCredentials: true });
        if (!done) setCourses(Array.isArray(r?.data?.items) ? r.data.items : []);
      } catch {
        if (!done) setCourses([]);
      }
    })();
    return () => { done = true; };
  }, []);

  const hasCourses = (courses?.length ?? 0) > 0;
  const subtitle = hasCourses ? "watch it now" : "enroll now";

  async function toggleExpand() {
    if (!hasCourses) return;
    if (!expanded && courses === null) {
      setLoading(true);
      try {
        const r = await api.get("/student/enrollments/active", { withCredentials: true });
        setCourses(Array.isArray(r?.data?.items) ? r.data.items : []);
      } catch {
        setCourses([]);
      } finally {
        setLoading(false);
      }
    }
    setExpanded((e) => !e);
  }

  return (
    <Card className="p-8 mb-8">
      <div className="flex items-center space-x-6 mb-8">
        <div className="relative">
          <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-3xl font-bold">
            {initials}
          </div>
          <div className="absolute -bottom-2 -right-2 bg-green-500 w-8 h-8 rounded-full flex items-center justify-center">
            <i className="fas fa-check text-white text-sm" />
          </div>
        </div>

        <div>
          <h3 className="text-2xl font-bold text-gray-900">{name}</h3>
          <p className="text-gray-600">@{handle}</p>
          <div className="flex items-center mt-2 gap-2">
            {statusBadges.map((b, idx) => (
              <span
                key={idx}
                className={`${b.bg} ${b.textColor} px-3 py-1 rounded-full text-sm font-medium`}
              >
                {b.text}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Details grid (kept intact, minus the old Payment Status) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Detail
          iconBg="bg-blue-100"
          iconClass="fas fa-calendar-alt text-blue-600"
          label="Date of Birth"
          value={dob}
        />
        <Detail
          iconBg="bg-green-100"
          iconClass="fas fa-user-plus text-green-600"
          label="Registration Date"
          value={registrationDate}
        />
        <Detail
          iconBg="bg-purple-100"
          iconClass="fas fa-shield-alt text-purple-600"
          label="Account Status"
          value={accountStatus}
          valueClass={accountStatus === "Active" ? "text-green-600" : "text-red-600"}
        />
      </div>

      {/* New: Courses Enrolled (replaces Payment Status UI) */}
      <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50/60 backdrop-blur p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-blue-900">Courses Enrolled</div>
            <div className="text-xs text-blue-700">{subtitle}</div>
          </div>

          {/* Advanced double arrow – only if there are courses */}
          {hasCourses && (
            <button
              onClick={toggleExpand}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-white/70 px-3 py-1.5 text-sm text-blue-700 hover:bg-white transition"
              aria-expanded={expanded}
              aria-controls="enrolled-courses"
              title={expanded ? "Hide courses" : "Show courses"}
            >
              {expanded ? "Hide" : "View"}
              <i className={`fas ${expanded ? "fa-angles-up" : "fa-angles-down"} transition-transform duration-200`} />
            </button>
          )}
        </div>

        {/* Animated list container */}
        <div
          id="enrolled-courses"
          className={`overflow-hidden transition-all duration-300 ease-out ${
            expanded ? "max-h-[36rem] mt-4 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="grid gap-3">
            {loading && (
              <div className="rounded-xl border border-blue-200 bg-white/60 backdrop-blur-sm p-4 animate-pulse">
                <div className="h-4 w-1/3 bg-blue-200 rounded mb-2" />
                <div className="h-3 w-1/4 bg-blue-100 rounded" />
              </div>
            )}

            {!loading && hasCourses &&
              courses!.map((c) => {
                const href = c.slug ? `/courses/${c.slug}` : `/courses/${c.courseId}`;
                return (
                  <a
                    key={String(c.courseId)}
                    href={href}
                    className="group block rounded-xl border border-blue-200 bg-white/70 backdrop-blur-sm px-4 py-3 shadow-sm hover:shadow transition"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-800 group-hover:text-blue-700">
                          {c.title || "Course"}
                        </div>
                        {c.enrolledAt && (
                          <div className="text-xs text-slate-500">
                            Enrolled on {new Date(c.enrolledAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <i className="fas fa-arrow-right-long text-slate-400 group-hover:text-blue-600 transition" />
                    </div>
                  </a>
                );
              })}
          </div>
        </div>

        {/* No courses → no arrow, simple note */}
        {!hasCourses && (
          <div className="mt-3 text-xs text-slate-600">
            You don’t have any active courses yet.
          </div>
        )}
      </div>
    </Card>
  );
}

function Detail({
  iconBg,
  iconClass,
  label,
  value,
  valueClass = "text-gray-900",
}: {
  iconBg: string;
  iconClass: string;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="flex items-center space-x-3">
        <div className={`${iconBg} p-2 rounded-lg`}>
          <i className={iconClass} />
        </div>
        <div>
          <p className="text-sm text-gray-600">{label}</p>
          <p className={`font-semibold ${valueClass}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}
