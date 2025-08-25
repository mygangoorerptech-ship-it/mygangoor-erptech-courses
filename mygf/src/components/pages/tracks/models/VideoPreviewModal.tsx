// mygf/src/components/pages/tracks/models/VideoPreviewModal.tsx
import React, { useEffect, useRef, useState } from "react";

export default function VideoPreviewModal({
  open,
  title,
  videoUrl,
  onClose,
}: {
  open: boolean;
  title: string;
  videoUrl?: string;
  onClose: () => void;
}) {
  const defaultUrl =
    videoUrl ||
    "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock page scroll when modal open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const togglePlay = async () => {
    if (!videoRef.current) return;
    try {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        await videoRef.current.play();
        setIsPlaying(true);
      }
    } catch {
      // autoplay blocked — user can tap again
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-md"
      aria-modal="true"
      role="dialog"
      onClick={onClose}
    >
      {/* modal panel */}
      <div
        className="relative w-[92vw] max-w-3xl rounded-lg border border-white/15 bg-slate-900/85 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h4 className="text-slate-50 font-semibold truncate pr-3">{title} — Preview</h4>

          <div className="flex items-center gap-2">
            {/* Download */}
            <a
              href={defaultUrl}
              download
              className="inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-1.5 text-sm text-slate-100 hover:bg-white/10"
              aria-label="Download preview"
              title="Download"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="-mt-px">
                <path d="M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5 19h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Download
            </a>

            {/* Close */}
            <button
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-200 hover:bg-white/10"
              aria-label="Close"
              title="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* video area */}
        <div className="relative aspect-video w-full overflow-hidden bg-black">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            src={defaultUrl}
            controls={false}
            playsInline
            preload="metadata"
          />

          {/* big glass play/pause button */}
          <button
            onClick={togglePlay}
            className="group absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-white/15 p-5 backdrop-blur hover:bg-white/25"
            aria-label={isPlaying ? "Pause" : "Play"}
            title={isPlaying ? "Pause" : "Play"}
          >
            <span className="relative inline-grid h-14 w-14 place-content-center rounded-full ring-2 ring-white/40 transition group-hover:ring-white/70">
              {/* glow */}
              <span className="absolute inset-0 rounded-full blur-2xl bg-white/20" />
              {/* icon */}
              {isPlaying ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="relative">
                  <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
                </svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="relative">
                  <path d="M8 5v14l11-7-11-7z" />
                </svg>
              )}
            </span>
          </button>

          {/* subtle bottom gradient */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      </div>
    </div>
  );
}
