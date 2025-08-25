// mygf/src/components/home/HeroLeftCard.tsx
import React, { useEffect, useRef, useState } from "react";
// import { categories } from "./data";
import { useNavigate } from "react-router-dom";

const DEMO_SRC =
  "https://interactive-examples.mdn.mozilla.org/media/cc0-videos/flower.mp4";
const DEMO_POSTER =
  "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=1600&auto=format&fit=crop"; // replace if you have a real poster

export default function HeroLeftCard() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const prev = document.body.style.overflow;
    if (open) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <div className="group rounded-3xl bg-white shadow-xl shadow-slate-900/10 px-6 sm:px-8 py-8 sm:py-10 transition-all relative">
        {/* curved white glow bottom-left */}
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-[40%] bg-white rotate-12 blur-2xl opacity-70" />
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
          Master skills.
          <br />
          Level up step by step.
        </h1>
        <p className="mt-3 text-slate-600 text-base sm:text-lg">
          Learn. Practice. Finish assignments.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
          onClick={() => navigate("/tracks")}
          className="rounded-xl bg-slate-900 text-white px-5 py-3 font-semibold shadow-lg shadow-slate-900/20 hover:shadow-slate-900/30 hover:-translate-y-0.5 active:translate-y-0 transition">
            Browse Courses
          </button>
          <button
            onClick={() => setOpen(true)}
            className="rounded-xl border-2 border-slate-300 text-slate-900 px-5 py-3 font-semibold hover:bg-slate-50 transition"
          >
            Watch Demo
          </button>
        </div>
      </div>

      {/* Category chips */}
      {/* <div className="mt-6 flex flex-wrap gap-3">
        {categories.map((c) => (
          <span
            key={c}
            className="rounded-full bg-white/30 text-white/95 backdrop-blur px-3 py-1 text-sm font-medium border border-white/40 hover:bg-white/40 transition"
          >
            {c}
          </span>
        ))}
      </div> */}

      {open && (
        <DemoVideoModal
          src={DEMO_SRC}
          poster={DEMO_POSTER}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/* ---------- Modal Component ---------- */
function DemoVideoModal({
  src,
  poster,
  onClose,
}: {
  src: string;
  poster?: string;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && e.target instanceof Node) {
        if (!panelRef.current.contains(e.target)) onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // update play state
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onPause);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onPause);
    };
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
  };

  return (
    <div
      className="
        fixed inset-0 z-[200]
        flex items-center justify-center
        p-4 sm:p-6
        bg-transparent
      "
      role="dialog"
      aria-modal="true"
    >
      {/* Panel */}
      <div
        ref={panelRef}
        className="
          relative w-[94vw] max-w-5xl aspect-video
          rounded-2xl overflow-hidden
          shadow-2xl shadow-black/50 ring-1 ring-white/10
          animate-[modalIn_.18s_ease-out]
        "
      >
        {/* blurred cover behind video */}
        <div
          className="
            absolute inset-0 -z-10
            blur-2xl scale-110 opacity-60
            bg-center bg-cover
          "
          style={{ backgroundImage: `url('${poster ?? ""}')` }}
        />

        {/* top toolbar */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-20">
          <a
            href="https://example.com"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-white/90 text-slate-900 px-3 py-1.5 text-xs font-semibold shadow hover:shadow-md hover:-translate-y-0.5 transition"
          >
            Test Link
          </a>

          <div className="flex items-center gap-2">
            <a
              href={src}
              download
              className="inline-flex items-center gap-2 rounded-lg bg-white/95 text-slate-900 px-3 py-1.5 text-xs sm:text-sm font-semibold shadow hover:shadow-md hover:-translate-y-0.5 transition"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 3v12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 19h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
              Download
            </a>

            <button
              onClick={onClose}
              aria-label="Close"
              className="h-9 w-9 rounded-full bg-white text-slate-900 shadow hover:shadow-md hover:-translate-y-0.5 active:scale-95 transition grid place-items-center"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* video */}
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          className="h-full w-full object-cover"
          controls
          preload="metadata"
          playsInline
        />

        {/* BIG center Play/Pause button — upgraded */}
        <button
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="
            absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
            h-20 w-20 sm:h-24 sm:w-24
            rounded-full
            bg-white/95 text-slate-900 border border-white/70
            shadow-[0_12px_30px_rgba(0,0,0,.35)]
            hover:scale-105 active:scale-95 transition
            grid place-items-center
          "
        >
          {/* pulsing ring only when paused */}
          {!isPlaying && (
            <>
              <span className="absolute inset-0 rounded-full ring-2 ring-white/70 opacity-90 pointer-events-none" />
              <span className="absolute inset-0 rounded-full ring-2 ring-white/60 animate-ping pointer-events-none" />
            </>
          )}

          {isPlaying ? (
            // pause icon (larger)
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <rect x="6" y="4.2" width="4.4" height="15.6" rx="1.4" fill="currentColor" />
              <rect x="13.6" y="4.2" width="4.4" height="15.6" rx="1.4" fill="currentColor" />
            </svg>
          ) : (
            // crisp play triangle with outer ring
            <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2.5" opacity=".35" />
              <path d="M20 16v16l14-8-14-8z" fill="currentColor" />
            </svg>
          )}
        </button>
      </div>

      <style>
        {`@keyframes modalIn {
            0% { transform: scale(.92); opacity: 0 }
            100% { transform: scale(1); opacity: 1 }
          }`}
      </style>
    </div>
  );
}
