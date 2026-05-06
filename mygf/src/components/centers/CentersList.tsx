//src/components/centers/CentersList.tsx
import CenterRow from "./CenterRow";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { listOrgs, getOrgStats } from "../../api/orgs";
import type { Organization } from "../../admin/types/org";

type Center = {
  id: string;
  name: string;
  location: string;
  region: string;
  totalCourses: number;
  categories: number;
  students: number;
};

type OrgStats = {
  centers: Array<{
    orgId: string;
    courses: number;
    categories: number;
    students: number;
  }>;
};

export default function CentersList({
  query,
  region,
}: {
  query: string;
  region: string;
}) {
  const [data, setData] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // pagination
  const pageSize = 3;
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState<OrgStats | null>(null);

  // 🔥 FETCH REAL DATA
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);

        const [orgRes, statsRes] = await Promise.all([
          listOrgs({
            q: query || undefined,
            status: "all",
          }),
          getOrgStats(),
        ]);

        if (!mounted) return;

        setData(orgRes.items || []);
        setStats(statsRes || null);
        setError(null);

      } catch (e: any) {
        if (!mounted) return;
        setError("Failed to load centers");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [query, region]);

  const statsMap = useMemo(() => {
    if (!stats?.centers) return new Map();

    return new Map(
      stats.centers.map((c) => [c.orgId, c])
    );
  }, [stats]);

  // 🔁 MAP BACKEND → UI MODEL
  const mapped: Center[] = useMemo(() => {
    return (data || []).map((org) => {
      const s = statsMap.get(org.id);

      return {
        id: org.id,

        name: org.name || "Unnamed Center",

        location:
          [org.city, org.state, org.country]
            .filter(Boolean)
            .join(", ") || "Location not available",

        region: org.state ? `${org.state} Region` : "General Region",

        // 🔥 REAL DATA (NO MOCK)
        totalCourses: s?.courses ?? 0,
        categories: s?.categories ?? 0,
        students: s?.students ?? 0,
      };
    });
  }, [data, statsMap]);

  // 🔍 FRONT FILTER (REGION ONLY)
  const filtered = useMemo(() => {
    return mapped.filter(
      (c) =>
        c.name.toLowerCase().includes(query.toLowerCase()) &&
        (region === "all" || c.region === region)
    );
  }, [mapped, query, region]);

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / pageSize)
  );

  const paginated = filtered.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

// RESPONSIVE + PREMIUM IMPROVED VERSION

return (
  <div className="overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-sm sm:rounded-[28px]">

    {/* DESKTOP HEADER */}
    <div className="hidden grid-cols-12 border-b border-gray-100 bg-gray-50/80 px-6 py-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-gray-500 md:grid">
      <div className="col-span-5">Center</div>
      <div className="col-span-2">Courses</div>
      <div className="col-span-2">Categories</div>
      <div className="col-span-2">Students</div>
      <div className="col-span-1"></div>
    </div>

    {/* MOBILE/TABLET TOP BAR */}
    <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-4 py-4 md:hidden">
      <div>
        <p className="text-sm font-semibold text-gray-900">
          Learning Centers
        </p>

        <p className="mt-1 text-xs text-gray-500">
          {filtered.length} centers available
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 shadow-sm">
        Page {page} / {totalPages}
      </div>
    </div>

    {/* STATES */}
    {loading && (
      <div className="flex min-h-[280px] items-center justify-center px-6 py-16">

        <div className="flex flex-col items-center text-center">

          {/* MODERN LOADER */}
          <div className="relative mb-5 flex h-14 w-14 items-center justify-center">
            <div className="absolute inset-0 animate-spin rounded-full border-[2.5px] border-gray-200 border-t-gray-900" />

            <div className="h-5 w-5 rounded-full bg-gray-900" />
          </div>

          <p className="text-sm font-medium text-gray-700">
            Loading centers
          </p>

          <p className="mt-1 text-xs text-gray-400">
            Fetching learning organizations...
          </p>
        </div>
      </div>
    )}

    {error && (
      <div className="flex min-h-[260px] flex-col items-center justify-center px-6 py-16 text-center">

        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-xl">
          ⚠️
        </div>

        <p className="text-base font-semibold text-gray-800">
          Failed to load centers
        </p>

        <p className="mt-1 text-sm text-gray-400">
          Please try again later
        </p>
      </div>
    )}

    {/* ROWS */}
    {!loading && !error && (
      <div className="divide-y divide-gray-100">
        {paginated.map((c) => (
          <CenterRow key={c.id} center={c} />
        ))}
      </div>
    )}

    {/* EMPTY */}
    {!loading && !error && filtered.length === 0 && (
      <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-16 text-center">

        <div className="relative mb-5 flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl border border-gray-100 bg-gray-50">

          <div className="absolute inset-0 bg-gradient-to-br from-gray-100/60 to-transparent" />

          <span className="relative z-10 text-2xl">
            🏢
          </span>
        </div>

        <p className="text-lg font-semibold tracking-tight text-gray-800">
          No centers found
        </p>

        <p className="mt-2 max-w-sm text-sm leading-6 text-gray-400">
          Try searching with another keyword or changing the selected region
        </p>
      </div>
    )}

    {/* PAGINATION */}
    {!loading && totalPages > 1 && (
      <div className="border-t border-gray-100 bg-gray-50/40 px-4 py-4 sm:px-6 sm:py-5">

        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">

          {/* LEFT */}
          <div className="text-xs text-gray-400 sm:text-sm">
            Showing{" "}
            <span className="font-medium text-gray-700">
              {paginated.length}
            </span>{" "}
            of{" "}
            <span className="font-medium text-gray-700">
              {filtered.length}
            </span>{" "}
            centers
          </div>

          {/* PAGINATION CONTROLS */}
          <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white p-1 shadow-sm">

            {/* PREV */}
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 transition-all duration-200 hover:bg-gray-100 hover:text-gray-900"
            >
              <ChevronLeft size={18} />
            </button>

            {/* PAGE NUMBERS */}
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={`flex h-10 min-w-[40px] items-center justify-center rounded-xl px-3 text-sm font-medium transition-all duration-200 ${
                    page === i + 1
                      ? "bg-gray-900 text-white shadow-sm"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            {/* NEXT */}
            <button
              onClick={() =>
                setPage((p) => Math.min(p + 1, totalPages))
              }
              className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 transition-all duration-200 hover:bg-gray-100 hover:text-gray-900"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
);
}