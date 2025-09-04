// src/components/join/steps/CourseStep.tsx
import React from "react";
import InlineError from "../ui/InlineError";
import { classNames } from "../utils";
import { formatINRFromPaise } from "../../../admin/utils/currency";

type Item = {
  id: string;
  title: string;

  // visual fields (all optional; we safely fallback)
  cover?: string;
  pill?: string;
  track?: string;
  level?: string;
  rating?: number;
  ratingCount?: number;

  // pricing (prefer paise; rupee fallback)
  pricePaise?: number | null;
  salePaise?: number | null;
  mrpPaise?: number | null;
  discountPercent?: number | null;
  price?: number | null; // rupees fallback

  // time
  duration?: string | null;    // e.g. "12h"
  durationHours?: number | null;

  // flags
  isPremium?: boolean | null;
};

function CourseStep({
  selected,
  onSelect,
  error,
  courses,
  pendingMap,
}: {
  selected: string;
  onSelect: (id: string) => void;
  error?: string;
  courses: Item[];
  pendingMap?: Record<string, string>;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((c) => {
          const isSelected = selected === c.id;
          const pending = pendingMap?.[c.id];

          // ---------- normalize to match Tracks/CourseCard pricing ----------
          const mrpPaise =
            typeof c.mrpPaise === "number"
              ? c.mrpPaise
              : typeof c.pricePaise === "number"
              ? c.pricePaise
              : typeof c.price === "number"
              ? Math.round((c.price || 0) * 100)
              : null;

          const discount = Number.isFinite(c.discountPercent) ? Number(c.discountPercent) : 0;

          const salePaise =
            typeof c.salePaise === "number"
              ? c.salePaise
              : mrpPaise != null && discount > 0
              ? Math.max(0, Math.round(mrpPaise * (1 - discount / 100)))
              : mrpPaise;

          const hasPrice = typeof mrpPaise === "number" && mrpPaise > 0;
          const isFree = !hasPrice;
          const isPremium = !!c.isPremium || isFree; // premium/free don’t show lock

          // duration text (like "12h")
          const dur =
            typeof c.durationHours === "number" && c.durationHours > 0
              ? `${c.durationHours}h`
              : c.duration ?? "—";

          // level fallback to Beginner (to mirror /tracks mapping)
          const level = (c.level || "Beginner") as string;

          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(c.id)}
              className={classNames(
                "group relative text-left overflow-hidden rounded-2xl bg-white border transition-shadow",
                isSelected
                  ? "ring-2 ring-indigo-600 border-transparent shadow-md"
                  : "border-slate-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-indigo-600"
              )}
            >
              {/* media header */}
              <div className="relative h-44">
                {/* skeleton */}
                {(!c.cover) && (
                  <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-100 to-slate-200" />
                )}

                {/* cover */}
                {c.cover && (
                  <img
                    src={c.cover}
                    alt={c.title}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}

                {/* soft lights */}
                <div className="pointer-events-none absolute inset-0 opacity-70">
                  <span className="absolute left-6 top-6 h-8 w-8 rounded-full bg-white/25 blur-md" />
                  <span className="absolute right-10 top-10 h-6 w-6 rounded-full bg-white/20 blur" />
                </div>

                {/* pill */}
                {c.pill && (
                  <span className="absolute left-3 top-3 z-20 px-3 py-1 text-xs font-semibold border border-white/60 text-white/90 backdrop-blur-md bg-slate-900/70">
                    {c.pill}
                  </span>
                )}

                {/* (static) wishlist heart visual only — not interactive */}
                <span
                  className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center border border-white/50 bg-white/25 backdrop-blur-sm text-white pointer-events-none"
                  aria-hidden="true"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12.1 21s-6.6-4.3-9.1-7.6C1.3 11.5 2 8.3 4.7 7c1.8-.9 4-.3 5.3 1.2 1.3-1.5 3.5-2.1 5.3-1.2 2.7 1.3 3.4 4.5 1.7 6.4-2.5 3.3-9 7.6-9 7.6z" />
                  </svg>
                </span>

                {/* lock bottom-left for paid/non-premium */}
                {hasPrice && !isPremium && (
                  <div className="pointer-events-none absolute left-3 bottom-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-black/30 backdrop-blur-sm">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="4" y="10" width="16" height="10" rx="2" />
                      <path d="M7 10V7a5 5 0 0 1 10 0v3" />
                    </svg>
                  </div>
                )}

                {/* premium/free badge (visual) */}
                {isPremium && (
                  <div className="pointer-events-none absolute left-3 bottom-3 z-20 inline-flex items-center gap-1 rounded-full bg-emerald-600/90 px-2 py-1 text-xs font-semibold text-white">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M20 6l-11 11-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Premium
                  </div>
                )}

                {/* pending badge (top-right, below heart) */}
                {pending && (
                  <span className="absolute right-3 top-14 z-20 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium bg-amber-50 text-amber-700 border-amber-200">
                    {pending}
                  </span>
                )}
              </div>

              {/* body — mirrors Tracks/CourseCard */}
              <div className="relative z-10 p-4">
                {c.track && (
                  <p className="text-xs uppercase tracking-wider text-slate-500">{c.track}</p>
                )}
                <h3 className="mt-1 line-clamp-2 font-semibold text-slate-900">{c.title}</h3>

                {/* price row (sale + mrp + %OFF) */}
                {!isPremium && hasPrice && salePaise != null && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {discount > 0 && (
                      <span className="rounded-md border border-rose-200 bg-rose-100 px-2 py-0.5 text-[10px] font-bold leading-4 text-rose-700">
                        {discount}% OFF
                      </span>
                    )}
                    <span className="text-lg sm:text-xl font-extrabold text-slate-900">
                      {formatINRFromPaise(salePaise)}
                    </span>
                    {discount > 0 && mrpPaise != null && (
                      <span className="text-sm text-slate-400 line-through">
                        {formatINRFromPaise(mrpPaise)}
                      </span>
                    )}
                  </div>
                )}

                {/* premium/free → certification pill instead of price */}
                {isPremium && (
                  <div className="mt-2">
                    <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-sm font-semibold text-emerald-700">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M20 6l-11 11-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Get Certified
                    </span>
                  </div>
                )}

                {/* rating + level */}
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-sm text-slate-700">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                    <span className="font-medium">{Number(c.rating ?? 0).toFixed(1)}</span>
                    {typeof c.ratingCount === "number" && (
                      <span className="text-xs text-slate-500">({c.ratingCount})</span>
                    )}
                  </div>
                  <span className="px-2 py-1 text-xs text-slate-700 border border-slate-300">
                    {level}
                  </span>
                </div>

                {/* footer: preview (visual only) + duration */}
                <div className="mt-4 flex items-center justify-between">
                  <span
                    className="border border-slate-300 px-3 py-2 text-xs font-medium text-slate-800 bg-white/80 pointer-events-none select-none"
                    aria-hidden="true"
                  >
                    Preview
                  </span>
                  <span className="text-xs text-slate-500">{dur}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {!error && courses.length === 0 && (
        <div className="text-center text-gray-500 text-sm mt-4">No courses available.</div>
      )}
      {error && <InlineError msg={error} />}
    </div>
  );
}

export default React.memo(CourseStep);
