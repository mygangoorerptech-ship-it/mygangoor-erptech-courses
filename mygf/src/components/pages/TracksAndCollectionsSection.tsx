// mygf/src/components/pages/TracksAndCollectionsSection.tsx
import { useMemo, useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { Availability, Chip, Course, Level } from "./tracks/types";
import NavBar from "../home/NavBar";
import useDebouncedValue from "./tracks/useDebouncedValue";
import SearchBar from "./tracks/SearchBar";
import FilterChips from "./tracks/FilterChips";
import SidebarSmartFilter from "./tracks/SidebarSmartFilter";
import type { Course as CourseType } from "./tracks/types";
import CourseCard from "./tracks/CourseCard";
import CourseCardSkeleton from "./tracks/CourseCardSkeleton";
import SidebarSkeleton from "./tracks/SidebarSkeleton";
import { useCourses } from "./tracks/useCourses";
import useAutoLoadOnIntersect from "./tracks/useAutoLoadOnIntersect";
import TopProgressBar from "../common/TopProgressBar";
import Footer from "../common/Footer";
import { useAuth } from "../../auth/store";
import type { User } from "../../auth/store";
import { useAuthHydration } from "../../hooks/useAuthHydration";
// NEW: enrollments + modal
import { api } from "../../api/client";
import JoinNowModal from "../join/JoinNowModal";
import { useWishlist } from "./tracks/wishlistStore";

/**
 * Parent: only auth/location hooks + redirects/skeleton.
 * No conditional hooks after returns.
 */
export default function TracksAndCollectionsSection() {
  useAuthHydration();
  const { user, status, hydrate } = useAuth();
  useEffect(() => { if (status === "idle") hydrate(); }, [status, hydrate]);

  const loc = useLocation();
  const role = String((user as any)?.role || "").toLowerCase();
  const ALLOW = status === "ready" && !!user && role === "orguser";

  // 1) Not hydrated yet -> skeleton (no heavy hooks here)
  if (status !== "ready") {
    return (
      <>
        <TopProgressBar active />
        <div className="relative z-20"><NavBar /></div>
        <section className="relative isolate w-full overflow-hidden pt-[5.5rem] sm:pt-[6rem] md:pt-[7rem]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-9 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => <CourseCardSkeleton key={i} />)}
              </div>
              <div className="lg:col-span-3"><SidebarSkeleton /></div>
            </div>
          </div>
        </section>
        <Footer brandName="ECA Academy" tagline="Learn smarter. Build faster." />
      </>
    );
  }

  // 2) Hydrated but unauthenticated -> go to login
  if (!user) {
    return <Navigate to="/login" replace state={{ next: loc.pathname }} />;
  }

  // 3) Authenticated but role not allowed -> dashboard
  if (!ALLOW) {
    return <Navigate to="/dashboard" replace />;
  }

  // 4) Auth ok & allowed -> render the heavy child (all hooks inside)
  return <TracksBody user={user} />;
}

/** Child component: contains all hook-heavy logic/UI. Always renders fully when mounted. */
function TracksBody({ user }: { user: User }) {
  // Local UI state
  const [query, setQuery] = useState("");
  const [activeChip, setActiveChip] = useState<Chip>("All");
  const [over12h, setOver12h] = useState(false);
  const [availability, setAvailability] = useState<Availability>("any");

  // Data hooks (safe to run now; auth is ready & allowed)
  const {
    data: apiCourses,
    loading,
    prefetching,
    error,
    reload,
    loadMore,
    hasMore
  } = useCourses({ enabled: true });

  const canAutoload = hasMore && !loading && !error;

  // Wishlist store init (runs once on mount)
  const wishlistStore = useWishlist();
  const { init: initWishlist, isWishlisted, toggle } = wishlistStore;
  useEffect(() => { void initWishlist?.().catch(() => {}); }, [initWishlist]);

  // ── Normalize ONLY: level, discountPercent, bundle cover image ───────────────
  const normalizedCourses: Course[] = useMemo(() => {
    const toUiLevel = (raw: any): Level => {
      const s = typeof raw === "string" ? raw.toLowerCase() : "";
      switch (s) {
        case "beginner": return "Beginner";
        case "intermediate": return "Intermediate";
        case "advanced": return "Advanced";
        default: return "Beginner";
      }
    };

    return (apiCourses ?? []).map((c) => {
      const rawLevel =
        (c as any).level ??
        (c as any).courseLevel ??
        (c as any).bundleLevel ?? null;

      const realDiscount =
        Number.isFinite((c as any).discountPercent) ? Number((c as any).discountPercent) : 0;

      const bundleCover =
        (c as any).bundleCoverUrl && String((c as any).bundleCoverUrl).trim()
          ? String((c as any).bundleCoverUrl)
          : (c.cover ?? undefined);

      return {
        ...c,
        level: toUiLevel(rawLevel),
        discountPercent: realDiscount,
        cover: bundleCover,
      };
    });
  }, [apiCourses]);

  const sentinelRef = useAutoLoadOnIntersect<HTMLDivElement>(
    canAutoload,
    loadMore,
    { root: null, rootMargin: "1200px 0px", threshold: 0.01 }
  );
  const debouncedQuery = useDebouncedValue(query, 250);

  // Back-to-top FAB visibility
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || 0;
      setShowTop(y > 700 && (apiCourses?.length || 0) >= 24);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [apiCourses?.length]);

  const filtered = useMemo(() => {
    const base: Course[] = normalizedCourses ?? [];
    let list: Course[] = [...base];

    if (activeChip === "Design") list = list.filter((c) => c.pill === "Design");
    if (activeChip === "Latest") list = list.sort((a, b) => +b.id - +a.id);
    if (over12h) list = list.filter((c) => c.durationHours >= 12);

    if (availability === "available") list = list.filter((c) => !!c.pill);
    if (availability === "unavailable") list = list.filter((c) => !c.pill);

    if (debouncedQuery.trim()) {
      const q = debouncedQuery.toLowerCase();
      list = list.filter((c) => {
        const t = c.track ? c.track.toLowerCase() : "";
        return (
          c.title.toLowerCase().includes(q) ||
          t.includes(q) ||
          c.level.toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [normalizedCourses, activeChip, over12h, availability, debouncedQuery]);

  // -------------------------
  // Premium / enrollment logic
  // -------------------------
  type ActiveEnrollment = {
    course?: { id?: string };
    courseId?: string;
    premium?: boolean;
    status?: string;        // 'paid' | 'premium' | ...
    paymentStatus?: string; // 'paid'
    access?: string;        // 'premium'
    paidAt?: string | null;
  };

  const [premiumIds, setPremiumIds] = useState<Set<string>>(new Set());
  const [showJoin, setShowJoin] = useState(false);
  const [joinCourseId, setJoinCourseId] = useState<string | undefined>(undefined);

  // Treat 0 or undefined paise as "free"
  const freeIds = useMemo(() => {
    const s = new Set<string>();
    (apiCourses ?? []).forEach((c) => {
      const p = (typeof c.pricePaise === "number")
        ? c.pricePaise
        : (typeof (c as any).price === "number" ? Math.round((c as any).price * 100) : 0);
      if (!p || p <= 0) s.add(String(c.id));
    });
    return s;
  }, [apiCourses]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/student/enrollments/active", { withCredentials: true });
        const items: ActiveEnrollment[] = Array.isArray(res?.data?.items) ? res.data.items : [];

        const paySet = new Set<string>();
        items.forEach((e) => {
          const id = String(e.courseId || e.course?.id || "");
          if (!id) return;
          const isPremium =
            e.premium === true ||
            e.status === "premium" ||
            e.status === "paid" ||
            e.paymentStatus === "paid" ||
            e.access === "premium" ||
            !!e.paidAt;
          if (isPremium) paySet.add(id);
        });

        const merged = new Set<string>([...Array.from(freeIds), ...Array.from(paySet)]);
        if (!cancelled) setPremiumIds(merged);
      } catch {
        if (!cancelled) setPremiumIds(new Set<string>(Array.from(freeIds)));
      }
    })();

    return () => { cancelled = true; };
  }, [freeIds, user?.id]);

  const isPremium = (courseId: string | number) => premiumIds.has(String(courseId));

  // Build wishlist array for Sidebar (keeps prop shape intact)
  const sidebarWishlist: CourseType[] = useMemo(
    () => normalizedCourses.filter((c) => isWishlisted?.(c.id)) as CourseType[],
    [normalizedCourses, wishlistStore]
  );

  return (
    <>
      {/* Top progress bar (active during load or prefetch) */}
      <TopProgressBar active={loading || prefetching} />
      {/* make the sticky NavBar full-bleed (not inside max-w) */}
      <div className="relative z-20">
        <NavBar />
      </div>

      <section aria-labelledby="tracks-title" className="relative isolate w-full overflow-hidden pt-24 md:pt-28">
        {/* abstract background */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,#9ae6b4,transparent)] blur-2xl opacity-60" />
          <div className="absolute -top-16 right-10 h-64 w-64 rounded-full bg-[radial-gradient(closest-side,#93c5fd,transparent)] blur-2xl opacity-70" />
          <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,#a7f3d0,transparent)] blur-2xl opacity-60" />
          <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_10%,rgba(255,255,255,0.7)_0%,rgba(255,255,255,0.3)_45%,rgba(255,255,255,0)_70%)]" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
          <h2 id="tracks-title" className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900/95">
            Browse Tracks &amp; Collections
          </h2>

          <div className="mt-6">
            <SearchBar value={query} onChange={setQuery} />
          </div>

          <FilterChips
            activeChip={activeChip}
            setActiveChip={setActiveChip}
            over12h={over12h}
            toggleOver12h={() => setOver12h((v) => !v)}
          />

          <div className="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Cards */}
            <div className="lg:col-span-9 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {loading &&
                Array.from({ length: 6 }).map((_, i) => <CourseCardSkeleton key={i} />)}

              {!loading && !error && filtered.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  isWishlisted={!!isWishlisted?.(course.id)}
                  onToggleWishlist={(c) => { if (!user) return; void toggle?.(c.id); }}
                  // NEW: pass premium + enroll handler (opens JoinNowModal)
                  isPremium={isPremium(course.id)}
                  onRequireEnroll={(c) => { setJoinCourseId(String(c.id)); setShowJoin(true); }}
                />
              ))}

              {!loading && !error && filtered.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-slate-300/70 bg-white/70 p-10 text-center text-slate-500">
                  No results. Try a different filter.
                </div>
              )}

              {!loading && error && (
                <div className="col-span-full rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
                  <p className="font-medium">Failed to load courses.</p>
                  <p className="text-sm opacity-80">{error}</p>
                  <button
                    onClick={reload}
                    className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                  >
                    Retry
                  </button>
                </div>
              )}
              {/* Infinite-scroll sentinel; shows subtle skeleton while loading */}
              {!error && filtered.length > 0 && (
                <div className="col-span-full">
                  {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                      {[...Array(3)].map((_, i) => <CourseCardSkeleton key={`s-${i}`} />)}
                    </div>
                  ) : hasMore ? (
                    <div ref={sentinelRef} className="h-6 w-full" />
                  ) : (
                    <div className="text-center text-xs text-slate-500">You’ve reached the end.</div>
                  )}
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-3">
              {loading ? (
                <SidebarSkeleton />
              ) : (
                <SidebarSmartFilter
                  wishlist={sidebarWishlist}
                  onToggleWishlist={(c) => { if (!user) return; void toggle?.(c.id); }}
                  availability={availability}
                  setAvailability={setAvailability}
                />
              )}
            </div>
          </div>
        </div>
              {/* Footer at the end */}
      <Footer
        brandName="ECA Academy"
        tagline="Learn smarter. Build faster."
      />
      </section>

      {/* Back-to-top FAB (keeps your visual language) */}
      {showTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white/90 text-slate-700 shadow hover:bg-white"
          aria-label="Back to top"
          title="Back to top"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 5l-7 7M12 5l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 5v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      )}

      {/* NEW: payment/enroll modal opened when access is locked */}
      {showJoin && <JoinNowModal selectedCourseId={joinCourseId} onClose={() => setShowJoin(false)} />}
    </>
  );
}
