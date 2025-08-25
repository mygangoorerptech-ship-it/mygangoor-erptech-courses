// mygf/src/components/course/ReviewsSection.tsx
import React, { useMemo, useRef, useState } from "react";
import type { Review } from "./types";

type Props = {
  reviews: Review[];
  onSubmitReview?: (r: { name?: string; rating: number; comment: string }) => void; // optional hook
};

export default function ReviewsSection({ reviews, onSubmitReview }: Props) {
  // ----- Expand/collapse reviews -----
  const [expanded, setExpanded] = useState(false);
  const hasOverflow = reviews.length > 3;
  const visibleReviews = useMemo(
    () => (expanded ? reviews : reviews.slice(0, 3)),
    [expanded, reviews]
  );

  // ----- Optional add review (collapsed by default) -----
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const maxChars = 500;

  const listRef = useRef<HTMLDivElement | null>(null);

  const handleSubmit = async () => {
    if (!rating || !comment.trim()) return;
    try {
      setSubmitting(true);
      // Pass to parent if provided; otherwise just no-op
      await Promise.resolve(onSubmitReview?.({ name: name.trim() || "Anonymous", rating, comment: comment.trim() }));
      // clear form (keep UI lightweight)
      setName("");
      setRating(0);
      setHoverRating(0);
      setComment("");
      setShowForm(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl p-8 shadow-lg mb-8">
      <h3 className="text-2xl font-bold text-gray-800 mb-6">Student Reviews</h3>

      {/* ---- Optional Add Review Toggle ---- */}
      <div className="mb-6">
        <button
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
          aria-expanded={showForm}
          aria-controls="add-review-panel"
          type="button"
        >
          <i className={`fas ${showForm ? "fa-minus" : "fa-plus"} text-xs`} />
          Add a review
        </button>

        {/* ---- Review Form ---- */}
        {showForm && (
          <div
            id="add-review-panel"
            className="mt-4 rounded-xl border border-slate-200 p-5 bg-slate-50/70"
          >
            {/* Name (optional) */}
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Your name (optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder="e.g., Sarah J."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />

            {/* Stars */}
            <div className="mt-4">
              <span className="block text-sm font-medium text-slate-700 mb-2">
                Your rating
              </span>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => {
                  const idx = i + 1;
                  const active = (hoverRating || rating) >= idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onMouseEnter={() => setHoverRating(idx)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(idx)}
                      className="p-1"
                      aria-label={`Rate ${idx} star${idx > 1 ? "s" : ""}`}
                    >
                      <i
                        className={`fas fa-star text-xl transition ${
                          active ? "text-yellow-400" : "text-gray-300"
                        }`}
                      />
                    </button>
                  );
                })}
                {rating > 0 && (
                  <span className="ml-2 text-sm text-slate-600">{rating}.0</span>
                )}
              </div>
            </div>

            {/* Comment */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Your review
              </label>
              <div className="relative">
                <textarea
                  value={comment}
                  onChange={(e) => {
                    const val = e.currentTarget.value.slice(0, maxChars);
                    setComment(val);
                  }}
                  rows={4}
                  placeholder="Share your experience…"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <div className="absolute bottom-2 right-3 text-xs text-slate-500">
                  {comment.length}/{maxChars}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                disabled={submitting || !rating || !comment.trim()}
                onClick={handleSubmit}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition
                  ${
                    submitting || !rating || !comment.trim()
                      ? "bg-blue-300 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
              >
                {submitting ? "Submitting…" : "Submit review"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ---- Reviews List ---- */}
      <div className="relative">
        {/* Scroll / expand container */}
        <div
          ref={listRef}
          className={`space-y-6 transition-all ${
            expanded
              ? "max-h-[22rem] overflow-y-auto pr-1"
              : hasOverflow
              ? "max-h-[18rem] overflow-hidden"
              : ""
          }`}
        >
          {visibleReviews.map((review, index) => (
            <div
              key={index}
              className="border-b border-gray-200 pb-6 last:border-b-0"
            >
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium mr-4">
                  {review.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800">{review.name}</h4>
                  <div className="flex items-center">
                    <div className="flex text-yellow-400 mr-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <i
                          key={i}
                          className={
                            "fas fa-star text-sm " +
                            (i < review.rating
                              ? "text-yellow-400"
                              : "text-gray-300")
                          }
                        />
                      ))}
                    </div>
                    <span className="text-sm text-gray-500">{review.date}</span>
                  </div>
                </div>
              </div>
              <p className="text-gray-600 leading-relaxed">{review.comment}</p>
            </div>
          ))}
        </div>

        {/* Gradient “tunnel” when collapsed */}
        {!expanded && hasOverflow && (
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white to-transparent" />
        )}
      </div>

      {/* Read more / Collapse */}
      {hasOverflow && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => {
              setExpanded((e) => !e);
              // after expanding, ensure focus/scroll feels smooth
              if (!expanded && listRef.current) {
                setTimeout(() => {
                  listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                }, 0);
              }
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            {expanded ? (
              <>
                <i className="fas fa-chevron-up text-xs" />
                Show less
              </>
            ) : (
              <>
                <i className="fas fa-chevron-down text-xs" />
                Read more reviews
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
