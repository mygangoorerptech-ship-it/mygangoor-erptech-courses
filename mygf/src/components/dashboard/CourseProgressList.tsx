// mygf/src/components/dashboard/CourseProgressList.tsx
import { useEffect, useMemo, useState } from "react";
import Card from "./ui/Card";
import CourseCard from "../pages/tracks/CourseCard";
import type { Course } from "../pages/tracks/types";
import { fetchCoursesPage, type Audience } from "../pages/tracks/api";
import { useAuth } from "../../auth/store";
import { useEnrollmentStore } from "../../store/enrollmentStore";

/**
 * Dashboard "Your courses" card.
 *
 * Enrollment state comes exclusively from useEnrollmentStore (global store).
 * This component only fetches courses — never enrollments directly.
 *
 * Reactive: when premiumIds in the store updates (optimistic OR server-confirmed),
 * `courses` useMemo recomputes and the UI updates without a full reload.
 */

function useAudience(): { audience: Audience; orgId: string | null } {
  const { user } = useAuth();
  const roles: string[] = useMemo(() => {
    const r = (user as any)?.roles || ((user as any)?.role ? [(user as any).role] : []);
    return Array.isArray(r) ? r.map(String) : [];
  }, [user]);

  const orgIdRaw = (user as any)?.orgId ?? null;
  const isOrg = !!orgIdRaw && roles.some((r) => /^(org(user|admin)|student)$/i.test(String(r)));
  return { audience: isOrg ? "org" : "public", orgId: isOrg ? String(orgIdRaw) : null };
}

export default function CourseProgressList() {
  const { audience, orgId } = useAudience();

  // ── Enrollment state — single source of truth ──────────────────────────────
  const { premiumIds, loading: enrollmentLoading, fetchActive } = useEnrollmentStore();

  // ── Course catalog (no enrollment data here) ────────────────────────────────
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Combined loading flag: show skeleton until both courses AND enrollments are ready
  const loading = coursesLoading || enrollmentLoading;

  // Trigger the global enrollment fetch on mount.
  // The store deduplicates concurrent calls via its loading flag.
  // This ensures the Dashboard works correctly even when the user navigates
  // directly here (without passing through TracksAndCollectionsSection first).
  useEffect(() => {
    void fetchActive();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load candidate courses (org bucket first, then public).
  // Does NOT fetch enrollments — that is the store's responsibility.
  useEffect(() => {
    let cancelled = false;
    setCoursesLoading(true);
    setError(null);

    async function load() {
      try {
        const PAGE = 24;
        const buckets: { aud: Audience; org: string | null }[] = [
          { aud: "org", org: orgId },
          { aud: "public", org: null },
        ];
        const collected: Course[] = [];

        for (const b of buckets) {
          const { items, nextCursor } = await fetchCoursesPage({
            audience: b.aud,
            orgId: b.org || (undefined as any),
            limit: PAGE,
          });
          for (const c of items) {
            if (collected.find((x) => String(x.id) === String(c.id))) continue;
            collected.push(c);
          }
          // Fetch one more page per bucket to widen the match window
          if (nextCursor) {
            const { items: more } = await fetchCoursesPage({
              audience: b.aud,
              orgId: b.org || (undefined as any),
              limit: PAGE,
              cursor: nextCursor,
            });
            for (const c of more) {
              if (collected.find((x) => String(x.id) === String(c.id))) continue;
              collected.push(c);
            }
          }
        }

        if (!cancelled) setAllCourses(collected);
      } catch (e) {
        console.error("[Dashboard.CourseProgressList] load error", e);
        if (!cancelled) setError("Failed to load courses");
      } finally {
        if (!cancelled) setCoursesLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [audience, orgId]);

  /**
   * Derive displayed courses reactively.
   *
   * Re-runs whenever allCourses OR premiumIds changes — so a payment that
   * calls addOptimistic() in the store will cause this to recompute
   * immediately without any local state update.
   *
   * Priority:
   *   1. Enrolled courses (in premiumIds) → up to 2
   *   2. Fallback: premium-priced courses as suggestions
   */
  const courses = useMemo(() => {
    const enrolled = allCourses.filter(
      (c) =>
        premiumIds.has(String(c.id)) ||
        premiumIds.has(String((c as any)._id))
    );
    if (enrolled.length > 0) return enrolled.slice(0, 2);

    // Fallback: suggest paid courses the student hasn't enrolled in yet
    return allCourses
      .filter((c) => {
        const paise = typeof c.pricePaise === "number" ? c.pricePaise : 0;
        return paise > 0;
      })
      .slice(0, 2);
  }, [allCourses, premiumIds]);

  return (
    <Card className="p-8">
      <h4 className="text-xl font-bold text-black mb-6">Your courses</h4>

      {/* Loading state: simple skeletons */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="h-64 rounded-2xl bg-gray-100 animate-pulse" />
          <div className="h-64 rounded-2xl bg-gray-100 animate-pulse" />
        </div>
      )}

      {/* Error state — neutral, non-alarming */}
      {!loading && error && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          Couldn't load courses. Please refresh the page.
        </div>
      )}

      {/* Courses (max 2) */}
      {!loading && !error && courses.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {courses.slice(0, 2).map((course) => {
            // Check both .id and ._id — MongoDB may return either
            const isEnrolled =
              premiumIds.has(String(course.id)) ||
              premiumIds.has(String((course as any)._id));

            return (
              <CourseCard
                key={course.id}
                course={course}
                isWishlisted={false}
                onToggleWishlist={() => {}}
                isPremium={isEnrolled}
                onRequireEnroll={() => {}}
              />
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && courses.length === 0 && (
        <div className="text-sm text-black py-4">
          No enrolled courses yet.
        </div>
      )}
    </Card>
  );
}
