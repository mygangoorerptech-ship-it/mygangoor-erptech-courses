// mygf/src/components/pages/TracksAndCollectionsSection.tsx
import { useMemo, useState } from "react";
import type { Availability, Chip, Course } from "./tracks/types";
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
import Footer from "../common/Footer";

export default function TracksAndCollectionsSection() {
    const [query, setQuery] = useState("");
    const [activeChip, setActiveChip] = useState<Chip>("All");
    const [wishlist, setWishlist] = useState<CourseType[]>([]);
    const [over12h, setOver12h] = useState(false);
    const [availability, setAvailability] = useState<Availability>("any");
    const { data: apiCourses, loading, error, reload } = useCourses();

    const debouncedQuery = useDebouncedValue(query, 250);

    const toggleWishlist = (c: CourseType) => {
        setWishlist((prev) => prev.find(x => x.id === c.id) ? prev.filter(x => x.id !== c.id) : [...prev, c]);
    };

    const filtered = useMemo(() => {
        const base: Course[] = apiCourses ?? [];
        let list: Course[] = [...base];

        if (activeChip === "Design") list = list.filter((c) => c.track === "Design");
        if (activeChip === "Latest") list = list.sort((a, b) => +b.id - +a.id);
        if (over12h) list = list.filter((c) => c.durationHours >= 12);

        if (availability === "available") list = list.filter((c) => !!c.pill);
        if (availability === "unavailable") list = list.filter((c) => !c.pill);

        if (debouncedQuery.trim()) {
            const q = debouncedQuery.toLowerCase();
            list = list.filter(
                (c) =>
                    c.title.toLowerCase().includes(q) ||
                    c.track.toLowerCase().includes(q) ||
                    c.level.toLowerCase().includes(q)
            );
        }
        return list;
    }, [apiCourses, activeChip, over12h, availability, debouncedQuery]);

    return (
        <>
                                {/* make the sticky NavBar full-bleed (not inside max-w) */}
                  <div className="relative z-20">
                    <NavBar />
                  </div>
        <section aria-labelledby="tracks-title" className="relative isolate w-full overflow-hidden">
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
                            <CourseCard key={course.id} course={course} isWishlisted={!!wishlist.find(w => w.id === course.id)} onToggleWishlist={toggleWishlist} />
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
                    </div>

                    {/* Sidebar */}
                    <div className="lg:col-span-3">
                        {loading ? (
                            <SidebarSkeleton />
                        ) : (
                            <SidebarSmartFilter wishlist={wishlist} onToggleWishlist={toggleWishlist}
                                availability={availability}
                                setAvailability={setAvailability}
                            />
                        )}
                    </div>
                </div>
            </div>
        </section>
              {/* Footer at the end */}
      <Footer
        brandName="MithunKumar"
        tagline="Learn smarter. Build faster."
 
      />
        </>
    );
}
