// mygf/src/components/dashboard/ProfileInfoCard.tsx
import { useEffect, useState, useMemo } from "react";
import Card from "./ui/Card";
import { useEnrollmentStore } from "../../store/enrollmentStore";
import { useAuth } from "../../auth/store";
import { fetchCoursesPage } from "../pages/tracks/api";
import type { Course } from "../pages/tracks/types";

type Props = {
  initials: string;
  name: string;
  handle: string;
  statusBadges: { text: string; bg: string; textColor: string }[];
  dob: string;
  registrationDate: string;
  paymentStatus: "Paid" | "Unpaid"; // kept for compatibility, not displayed
  accountStatus: "Active" | "Suspended";
};

export default function ProfileInfoCard({
  initials,
  name,
  handle,
  statusBadges,
  dob,
  registrationDate,
  accountStatus,
}: Props) {
  // ── Step 2: premiumIds from global store (no duplicate fetch) ──────────────
  const premiumIds = useEnrollmentStore((s) => s.premiumIds);

  // ── Step 3: course catalog — same source as CourseProgressList ─────────────
  const { user } = useAuth();
  const orgId: string | null = (user as { orgId?: string | null } | null)?.orgId ?? null;

  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setCoursesLoading(true);
    (async () => {
      try {
        const { items } = await fetchCoursesPage({
          audience: orgId ? "org" : "public",
          orgId: orgId ?? undefined,
          limit: 24,
        });
        if (!cancelled) setAllCourses(items);
      } catch {
        // silently ignore — list stays empty
      } finally {
        if (!cancelled) setCoursesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgId]);

  // ── Step 4: filter catalog by premiumIds ───────────────────────────────────
  // Check both .id and ._id — MongoDB may expose either depending on the endpoint
  const enrolledCourses = useMemo(
    () =>
      allCourses.filter(
        (c) =>
          premiumIds.has(String(c.id)) ||
          premiumIds.has(String((c as { _id?: string })._id ?? ""))
      ),
    [allCourses, premiumIds]
  );

  const hasCourses = enrolledCourses.length > 0;
  const subtitle = hasCourses ? "watch it now" : "enroll now";

  function toggleExpand() {
    if (!hasCourses) return;
    setExpanded((e) => !e);
  }

  return (
    <Card className="mb-6">
      <div className="flex items-center space-x-6 mb-8">
        <div className="relative">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-700 text-xl font-semibold">
            {initials}
          </div>
          <div className="absolute -bottom-2 -right-2 bg-green-500 w-8 h-8 rounded-full flex items-center justify-center">
            <i className="fas fa-check text-white text-sm" />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
<p className="text-sm text-gray-500">@{handle}</p>
          <div className="flex items-center mt-2 gap-2">
            {statusBadges.map((b, idx) => (
              <span
                key={idx}
                className={`${b.bg} ${b.textColor} px-2.5 py-0.5 rounded-md text-xs font-medium`}
              >
                {b.text}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Details grid */}
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

      {/* Courses Enrolled */}
      <div className="mt-6 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">Courses Enrolled</div>
            <div className="text-xs text-gray-700">{subtitle}</div>
          </div>

          {hasCourses && (
            <button
              onClick={toggleExpand}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition"
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
          className={`overflow-hidden transition-all duration-300 ease-out ${expanded ? "max-h-[36rem] mt-4 opacity-100" : "max-h-0 opacity-0"
            }`}
        >
          <div className="grid gap-3">
            {/* Skeleton while catalog is loading */}
            {coursesLoading && (
              <div className="rounded-xl border border-blue-200 bg-white/60 backdrop-blur-sm p-4 animate-pulse">
                <div className="h-4 w-1/3 bg-blue-200 rounded mb-2" />
                <div className="h-3 w-1/4 bg-blue-100 rounded" />
              </div>
            )}

            {/* Step 5: render enrolled courses from catalog */}
            {!coursesLoading &&
              enrolledCourses.map((course) => {
                const href = `/course/${course.id}`;
                return (
                  <a
                    key={String(course.id)}
                    href={href}
                    className="group block rounded-lg border border-gray-200 bg-white px-4 py-3 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-gray-900 group-hover:text-indigo-600">
                          {course.title ||
                            (course as { name?: string }).name ||
                            "Untitled Course"}
                        </div>
                        {course.track && (
                          <div className="text-xs text-slate-500 uppercase tracking-wide">
                            {course.track}
                          </div>
                        )}
                      </div>
                      <i className="fas fa-arrow-right-long text-gray-400 group-hover:text-indigo-600 transition" />
                    </div>
                  </a>
                );
              })}
          </div>
        </div>

        {/* No courses → simple note */}
        {!hasCourses && !coursesLoading && (
          <div className="mt-3 text-xs text-slate-600">
            You don't have any active courses yet.
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
    <div className="border border-gray-200 rounded-lg p-4">
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
