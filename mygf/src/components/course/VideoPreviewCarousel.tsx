// mygf/src/components/course/VideoPreviewCarousel.tsx
import React, { useEffect, useRef, useState } from "react";

export type PreviewSlide = {
  poster: string;
  video?: string | null;
  label?: string;
};

export default function VideoPreviewCarousel({
  slides,
  className = "",
  onSlideChange,
  initialIndex = 0,
}: {
  slides: PreviewSlide[];
  className?: string;
  onSlideChange?: (index: number) => void;
  initialIndex?: number;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [open, setOpen] = useState(false);
  const count = Math.max(1, slides?.length || 0);
  const current = slides?.[index] ?? slides?.[0];

  // Emit slide change event AFTER the component renders.
  useEffect(() => {
    if (typeof onSlideChange === "function") {
      onSlideChange(index);
    }
  }, [index, onSlideChange]);

  // Navigation functions only update local index; effect emits change.
  const prev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIndex((i) => (i - 1 + count) % count);
  };
  const next = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIndex((i) => (i + 1) % count);
  };

  // Touch swipe support
  const startX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startX.current == null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    if (Math.abs(dx) > 40) (dx < 0 ? next() : prev());
    startX.current = null;
  };

  return (
    <>
      <div
        className={[
          "relative group w-full max-w-[420px] aspect-video rounded-2xl overflow-hidden",
          "shadow-md ring-1 ring-black/5 focus-within:ring-2 focus-within:ring-blue-400",
          "transition-transform hover:-translate-y-0.5",
          className,
        ].join(" ")}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Images */}
        {slides.map((s, i) => (
          <img
            key={i}
            src={s.poster}
            alt={s.label ?? `Preview ${i + 1}`}
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
            style={{ opacity: index === i ? 1 : 0, pointerEvents: "none" }}
            loading="lazy"
          />
        ))}

        {/* Background overlays */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-500/25 to-purple-600/25" />
        <span className="pointer-events-none absolute left-4 top-4 h-7 w-7 rounded-full bg-white/25 blur-md" />
        <span className="pointer-events-none absolute right-6 top-6 h-5 w-5 rounded-full bg-white/20 blur" />

        {/* Play button for videos */}
        {current?.video ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Play course preview"
            className="relative z-10 grid place-items-center h-full w-full focus:outline-none"
          >
            <div className="rounded-full bg-white/90 p-4 shadow-md transition group-hover:scale-105">
              <i className="fas fa-play text-2xl text-slate-800" />
            </div>
          </button>
        ) : (
          <div className="relative z-10 h-full w-full" aria-hidden />
        )}

        {/* Previous/Next buttons */}
        {count > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Previous"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-white/90 p-2 shadow hover:bg-white"
            >
              <i className="fas fa-chevron-left text-slate-800" />
            </button>
            <button
              onClick={next}
              aria-label="Next"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-white/90 p-2 shadow hover:bg-white"
            >
              <i className="fas fa-chevron-right text-slate-800" />
            </button>
          </>
        )}

        {/* Dot indicators */}
        {count > 1 && (
          <div className="absolute bottom-2 left-0 right-0 z-20 flex items-center justify-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                aria-label={`Go to slide ${i + 1}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex(i); // trigger effect; no direct emit here
                }}
                className={[
                  "h-2.5 w-2.5 rounded-full transition",
                  index === i ? "bg-white shadow" : "bg-white/60 hover:bg-white/80",
                ].join(" ")}
              />
            ))}
          </div>
        )}
      </div>

      {/* Video modal */}
      {open && current && (
        <VideoModal
          poster={current.poster}
          src={current.video}
          title={current.label ?? "Course Preview"}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function VideoModal({
  poster,
  src,
  title,
  onClose,
}: {
  poster: string;
  src?: string | null;
  title?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="mx-auto mt-12 w-[92%] max-w-3xl rounded-2xl bg-slate-900 shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <h4 className="text-white/90 font-semibold">{title}</h4>
          <button
            onClick={onClose}
            aria-label="Close preview"
            className="rounded-md p-2 text-white/70 hover:text-white hover:bg-white/10"
          >
            <i className="fas fa-times" />
          </button>
        </div>
        <div className="px-4 pb-4">
          <div className="relative w-full rounded-xl overflow-hidden">
            <div className="aspect-video w-full">
              {src ? (
                <video
                  controls
                  autoPlay
                  poster={poster}
                  className="h-full w-full"
                >
                  <source src={src} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              ) : (
                <img
                  src={poster}
                  alt={title || "Course preview"}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
