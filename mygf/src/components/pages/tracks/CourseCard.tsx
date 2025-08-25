// mygf/src/components/pages/tracks/CourseCard.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import type { Course } from "./types";
import VideoPreviewModal from "./models/VideoPreviewModal"; // <-- add this

export default function CourseCard({
  course,
  isWishlisted,
  onToggleWishlist,
}: {
  course: Course;
  isWishlisted: boolean;
  onToggleWishlist: (c: Course) => void;
}) {
  const [showPreview, setShowPreview] = React.useState(false);
  const navigate = useNavigate();

  const handleCardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/course/${course.id}`, { state: { course } });
  };

  return (
    <article
    onClick={handleCardClick}
    className="group relative overflow-hidden border border-slate-300 bg-white/80 shadow-sm hover:shadow-md focus-within:ring-2 focus-within:ring-slate-300">
      {/* Media header */}
      <div className="relative h-44">
        <img src={course.cover} alt={course.title} className="h-full w-full object-cover" />

        {/* soft lights */}
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <span className="absolute left-6 top-6 h-8 w-8 rounded-full bg-white/25 blur-md" />
          <span className="absolute right-10 top-10 h-6 w-6 rounded-full bg-white/20 blur" />
        </div>

        {/* Pills except 'Free' */}
        {course.pill && course.pill !== "Free" && (
          <span
            className={[
              "absolute left-3 top-3 px-3 py-1 text-xs font-semibold border border-white/60 text-white/90 backdrop-blur-md",
              course.pill === "Top Rated" ? "bg-rose-500/90" : "bg-cyan-500/90",
            ].join(" ")}
          >
            {course.pill}
          </span>
        )}

        {/* Wishlist heart */}
        <button
          className={`absolute right-3 top-3 z-20 inline-flex items-center justify-center h-9 w-9 border backdrop-blur-sm transition-colors ${
            isWishlisted
              ? "text-rose-600 border-rose-400 bg-white/60"
              : "text-white border-white/50 bg-white/25 hover:bg-white/35"
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
      </div>

      {/* Body */}
      <div className="relative z-10 p-4">
        <p className="text-xs uppercase tracking-wider text-slate-500">{course.track}</p>
        <h3 className="mt-1 line-clamp-2 text-slate-900 font-semibold">{course.title}</h3>

        {/* Rating + Level */}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1 text-sm text-slate-700">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
            <span className="font-medium">{course.rating.toFixed(1)}</span>
            {typeof course.ratingCount === "number" && <span className="text-xs text-slate-500">({course.ratingCount})</span>}
          </div>
          <span className="text-xs px-2 py-1 border border-slate-300 text-slate-700">{course.level}</span>
        </div>

        {/* Footer actions */}
        <div className="mt-4 flex items-center justify-between">
          <button
            className="border border-slate-300 px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-300"
            aria-label={`Preview ${course.title}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowPreview(true);
            }}
          >
            Preview
          </button>
          <span className="text-xs text-slate-500">{course.durationHours}h</span>
        </div>
      </div>

      {/* overlay anchor under content to keep buttons clickable */}
      <a href="#" className="absolute inset-0 z-0 outline-none" aria-label={`Open ${course.title}`} />

      {/* Modal */}
      <VideoPreviewModal
        open={showPreview}
        title={course.title}
        // You can add course.previewUrl later; this keeps it static for demo
        videoUrl={undefined}
        onClose={() => setShowPreview(false)}
      />
    </article>
  );
}
