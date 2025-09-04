// mygf/src/components/dashboard/CourseProgressList.tsx
import  { useEffect, useMemo, useState } from "react";
import Card from "./ui/Card";
import CourseCard from "../pages/tracks/CourseCard";
import type { Course } from "../pages/tracks/types";
import { fetchCoursesPage, type Audience } from "../pages/tracks/api";
import { api } from "../../api/client";
import { useAuth } from "../../auth/store";

/**
 * Dashboard “Your courses” card.
 * - Shows the user’s 2 most recent enrolled PREMIUM courses (paid/premium access).
 * - If none, falls back to 2 recent PREMIUM courses from the user’s organisation (not enrolled).
 * - Reuses the exact CourseCard design from tracks.
 * - Keeps the rest of the dashboard logic untouched.
 */

type ActiveEnrollment = {
  course?: { id?: string };
  courseId?: string;
  premium?: boolean;
  status?: string;        // 'paid' | 'premium' | ...
  paymentStatus?: string; // 'paid'
  access?: string;        // 'premium'
  paidAt?: string | null;
};

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      // Helper to fetch fallback premium suggestions
      async function fetchFallback(): Promise<Course[]> {
        const PAGE = 24;
        const buckets: { aud: Audience; org: string | null }[] = [
          { aud: "org", org: orgId },
          { aud: "public", org: null },
        ];
        const want: Course[] = [];
        for (const b of buckets) {
          const { items: pageItems } = await fetchCoursesPage({
            audience: b.aud,
            orgId: b.org || (undefined as any),
            limit: PAGE,
          });
          const premium = pageItems.filter((c) => {
            const paise =
              typeof c.pricePaise === "number"
                ? c.pricePaise
                : typeof (c as any).price === "number"
                ? Math.round((c as any).price * 100)
                : 0;
            return paise > 0;
          });
          for (const m of premium) {
            if (want.find((x) => String(x.id) === String(m.id))) continue;
            want.push(m);
            if (want.length >= 2) break;
          }
          if (want.length >= 2) break;
        }
        return want.slice(0, 2);
      }

      try {
        // 1) Fetch active enrollments to know which course IDs are paid/premium
        const res = await api.get("/student/enrollments/active", { withCredentials: true });
        const items: ActiveEnrollment[] = Array.isArray(res?.data?.items) ? res.data.items : [];
        const paid = new Set<string>();
        items.forEach((e) => {
          const id = String(e.courseId || e.course?.id || "");
          if (!id) return;
          const isPrem =
            e.premium === true ||
            e.status === "premium" ||
            e.status === "paid" ||
            e.paymentStatus === "paid" ||
            e.access === "premium" ||
            !!e.paidAt;
          if (isPrem) paid.add(id);
        });

        // 2) Build a small catalog (public + org) and pick the user’s premium courses (max 2)
        const collected: Course[] = [];
        const PAGE = 24;

        const buckets: { aud: Audience; org: string | null }[] = [
          { aud: "org", org: orgId },
          { aud: "public", org: null },
        ];

        for (const b of buckets) {
          const { items: pageItems, nextCursor } = await fetchCoursesPage({
            audience: b.aud,
            orgId: b.org || (undefined as any),
            limit: PAGE,
          });
          const matches = pageItems.filter((c) => paid.has(String(c.id)));
          for (const m of matches) {
            if (collected.find((x) => String(x.id) === String(m.id))) continue;
            collected.push(m);
            if (collected.length >= 2) break;
          }
          if (collected.length >= 2) break;

          if (nextCursor && collected.length < 2) {
            const { items: more } = await fetchCoursesPage({
              audience: b.aud,
              orgId: b.org || (undefined as any),
              limit: PAGE,
              cursor: nextCursor,
            });
            const moreMatches = more.filter((c) => paid.has(String(c.id)));
            for (const m of moreMatches) {
              if (collected.find((x) => String(x.id) === String(m.id))) continue;
              collected.push(m);
              if (collected.length >= 2) break;
            }
          }
        }

        if (collected.length < 1) {
          const fb = await fetchFallback();
          if (!cancelled) setCourses(fb);
        } else {
          if (!cancelled) setCourses(collected.slice(0, 2));
        }
      } catch (e) {
        console.error("[Dashboard.CourseProgressList] load error", e);
        // graceful fallback even if enrollments API errors
        try {
          const fb = await fetchFallback();
          if (!cancelled) setCourses(fb);
        } catch (e2) {
          if (!cancelled) setError("Failed to load courses");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [audience, orgId]);

  return (
    <Card className="p-8">
      <h4 className="text-xl font-bold text-gray-900 mb-6">Your courses</h4>

      {/* Loading state: simple skeletons */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="h-64 rounded-2xl bg-gray-100 animate-pulse" />
          <div className="h-64 rounded-2xl bg-gray-100 animate-pulse" />
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Courses (max 2) */}
      {!loading && !error && courses.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {courses.slice(0, 2).map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              isWishlisted={false}
              onToggleWishlist={() => {}}
              // enrolled → premium access allowed
              isPremium={true}
              onRequireEnroll={() => {}}
            />
          ))}
        </div>
      )}

      {/* Nothing at all */}
      {!loading && !error && courses.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white/70 p-6 text-slate-600 text-sm">
          No courses to show yet.
        </div>
      )}
    </Card>
  );
}
