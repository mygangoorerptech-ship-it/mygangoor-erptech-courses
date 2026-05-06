// mygf/src/components/pages/tracks/CourseCard.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import type { Course } from "./types";
import VideoPreviewModal from "./models/VideoPreviewModal";
// ⬇️ use your paise→INR formatter
import { formatINRFromPaise } from "../../../admin/utils/currency";
// import ViewDetails from "../tracks/viewDetails"; // UNLINKED: Now using plain HTML page

export default function CourseCard({
  course,
  isWishlisted,
  onToggleWishlist,
  // NEW:
  isPremium = false,
  onRequireEnroll,
}: {
  course: Course;
  isWishlisted: boolean;
  onToggleWishlist: (c: Course) => void;
  // NEW:
  isPremium?: boolean;
  onRequireEnroll?: (c: Course) => void;
}) {
  const [showPreview, setShowPreview] = React.useState(false);
  // const [showDetails, setShowDetails] = React.useState(false); // UNLINKED: Now using plain HTML page
  const [imgLoaded, setImgLoaded] = React.useState(false);
  const [imgError, setImgError] = React.useState(false);
  const navigate = useNavigate();
  // --- Price in paise (prefer precomputed from fetch) ---
  const mrpPaiseFromFetch = (course as any).mrpPaise as number | undefined;
  const salePaiseFromFetch = (course as any).salePaise as number | undefined;

  const pricePaise =
    typeof mrpPaiseFromFetch === "number"
      ? mrpPaiseFromFetch
      : typeof course.pricePaise === "number"
        ? course.pricePaise
        : typeof (course as any).price === "number"
          ? Math.round((course as any).price * 100)
          : null;

  const discount = typeof course.discountPercent === "number" ? course.discountPercent : 0;

  const salePaise =
    typeof salePaiseFromFetch === "number"
      ? salePaiseFromFetch
      : pricePaise != null && discount > 0
        ? Math.max(0, Math.round(pricePaise * (1 - discount / 100)))
        : pricePaise;

  const hasPrice = typeof pricePaise === "number" && pricePaise > 0;
  const isFree = !hasPrice;

  const handleCardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Gate navigation: premium/free -> navigate; otherwise -> enroll modal
    if (isPremium || isFree) {
      navigate(`/course/${course.id}`, { state: { course } });
    } else {
      onRequireEnroll?.(course);
    }
  };

  const names = course.centerNames || [];

  return (
    <article
      onClick={handleCardClick}
      className="group relative overflow-hidden border border-slate-300 bg-white/80 shadow-sm hover:shadow-md focus-within:ring-2 focus-within:ring-slate-300"
    >
      {/* Media header */}
      <div className="relative h-44">
        {/* Skeleton if no cover / not loaded / failed */}
        {(!course.cover || !imgLoaded || imgError) && (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-100 to-slate-200" />
        )}

        {/* Real image (lazy) */}
        {course.cover && (
          <img
            src={course.cover}
            alt={course.title}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            className={`h-full w-full object-cover transition-opacity duration-300 ${imgLoaded && !imgError ? "opacity-100" : "opacity-0"
              }`}
          />
        )}

        {/* soft lights */}
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <span className="absolute left-6 top-6 h-8 w-8 rounded-full bg-white/25 blur-md" />
          <span className="absolute right-10 top-10 h-6 w-6 rounded-full bg-white/20 blur" />
        </div>

        {/* Pill = Category (no fallback) */}
        {course.pill && (
          <span className="absolute left-3 top-3 px-3 py-1 text-xs font-semibold border border-white/60 text-white/90 backdrop-blur-md bg-slate-900/70">
            {course.pill}
          </span>
        )}

        {/* Wishlist */}
        <button
          className={`absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center border backdrop-blur-sm transition-colors ${isWishlisted ? "text-rose-600 border-rose-400 bg-white/60" : "text-white border-white/50 bg-white/25 hover:bg-white/35"
            }`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleWishlist(course);
          }}
          aria-label="Toggle wishlist"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill={isWishlisted ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
            <path d="M12.1 21s-6.6-4.3-9.1-7.6C1.3 11.5 2 8.3 4.7 7c1.8-.9 4-.3 5.3 1.2 1.3-1.5 3.5-2.1 5.3-1.2 2.7 1.3 3.4 4.5 1.7 6.4-2.5 3.3-9 7.6-9 7.6z" />
          </svg>
        </button>

        {/* Lock overlay for PAID courses only when NOT premium */}
        {hasPrice && !(isPremium || isFree) && (
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

        {/* Premium stamp when premium/free */}
        {(isPremium || isFree) && (
          <div className="pointer-events-none absolute left-3 bottom-3 z-20 inline-flex items-center gap-1 rounded-full bg-emerald-600/90 px-2 py-1 text-xs font-semibold text-white">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M20 6l-11 11-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Premium
          </div>
        )}
      </div>

      {/* Body */}
      <div className="relative z-10 p-4">
        {/* track shows slug (no fallback) */}
        {course.track && <p className="text-xs uppercase tracking-wider text-slate-500">{course.track}</p>}
        <h3 className="mt-1 line-clamp-2 font-semibold text-slate-900">
          {course.title || (course as { name?: string }).name || "Untitled Course"}
        </h3>

        {/* Price row (hidden when premium/free) */}
        {!(isPremium || isFree) && hasPrice && salePaise != null && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {discount > 0 && (
              <span className="rounded-md border border-rose-200 bg-rose-100 px-2 py-0.5 text-[10px] font-bold leading-4 text-rose-700">
                {discount}% OFF
              </span>
            )}
            <span className="text-lg sm:text-xl font-extrabold text-slate-900">
              {formatINRFromPaise(salePaise)}
            </span>
            {discount > 0 && pricePaise != null && (
              <span className="text-sm text-slate-400 line-through">
                {formatINRFromPaise(pricePaise)}
              </span>
            )}
          </div>
        )}

        {/* If premium/free, show a subtle pill instead of price */}
        {(isPremium || isFree) && (
          <div className="mt-2">
            <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-sm font-semibold text-emerald-700">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M20 6l-11 11-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Get Certified
            </span>
          </div>
        )}

        {/* Rating + Level (demo keeps) */}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1 text-sm text-slate-700">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
            <span className="font-medium">{Number(course.rating ?? 0).toFixed(1)}</span>
            {typeof course.ratingCount === "number" && <span className="text-xs text-slate-500">({course.ratingCount})</span>}
          </div>
          <span className="px-2 py-1 text-xs text-slate-700 border border-slate-300">{course.level}</span>
        </div>

        {/* org badge */}
        <div className="mt-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500">
            {names.length > 0
              ? names.length > 2
                ? `${names.slice(0, 2).join(", ")} +${names.length - 2}`
                : names.join(", ")
              : "Global"}
          </span>
        </div>

        {/* Footer actions */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              className="border border-slate-300 px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2"
              aria-label={`Preview ${course.title}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowPreview(true);
              }}
            >
              Preview
            </button>

            {/* NEW: View Detail button right after Preview */}
            <button
              className="border border-slate-300 px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2"
              aria-label={`View details for ${course.title}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate(`/course/${course.id}`);
              }}
            >
              View Detail
            </button>
          </div>
          <span className="text-xs text-slate-500">{course.durationHours}h</span>
        </div>
      </div>

      {/* overlay anchor under content to keep buttons clickable */}
      <a href="#" className="absolute inset-0 z-0 outline-none" aria-label={`Open ${course.title}`} />

      {/* Modal */}
      <VideoPreviewModal
        open={showPreview}
        title={course.title}
        videoUrl={course.previewUrl ?? undefined}
        onClose={() => setShowPreview(false)}
      />

      {/* UNLINKED: ViewDetails modal - now using plain HTML page */}
      {/* <ViewDetails
        open={showDetails}
        courseId={(course as any).id || (course as any)._id}
        onClose={() => setShowDetails(false)}
        onRequireEnroll={() => onRequireEnroll?.(course)}
      /> */}
    </article>
  );
}
