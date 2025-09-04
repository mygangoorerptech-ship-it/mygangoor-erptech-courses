import { useEffect, useRef, useState } from "react";

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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

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

  // Reset state when reopened
  useEffect(() => {
    if (!open) return;
    setIsPlaying(false);
    setReady(false);
    setFailed(false);
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      } catch {}
    }
  }, [open]);

  const togglePlay = async () => {
    if (!videoRef.current || !videoUrl || failed) return;
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
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h4 className="pr-3 truncate font-semibold text-slate-50">{title} — Preview</h4>

          <div className="flex items-center gap-2">
            {/* Download (only if real URL present) */}
            {videoUrl ? (
              <a
                href={videoUrl}
                download
                className="inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-1.5 text-sm text-slate-100 hover:bg-white/10"
                aria-label="Download preview"
                title="Download"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="-mt-px">
                  <path d="M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5 19h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Download
              </a>
            ) : (
              <span
                className="inline-flex cursor-not-allowed items-center gap-2 rounded-md border border-white/10 px-3 py-1.5 text-sm text-slate-300/60"
                title="No preview available"
                aria-disabled="true"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="-mt-px opacity-60">
                  <path d="M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5 19h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Download
              </span>
            )}

            {/* Close */}
            <button
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-200 hover:bg-white/10"
              aria-label="Close"
              title="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* video area */}
        <div className="relative aspect-video w-full overflow-hidden bg-black">
          {/* Skeleton / Placeholder (shown when no URL, not ready yet, or failed) */}
          {(!videoUrl || !ready || failed) && (
            <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-100 to-slate-200" />
          )}

          {/* Real video only if URL present */}
          {videoUrl && !failed && (
            <video
              ref={videoRef}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                ready ? "opacity-100" : "opacity-0"
              }`}
              src={videoUrl}
              controls={false}
              playsInline
              preload="metadata"
              onCanPlay={() => setReady(true)}
              onLoadedData={() => setReady(true)}
              onError={() => setFailed(true)}
              onPause={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
            />
          )}

          {/* big glass play/pause button (only if we have a playable URL) */}
          {videoUrl && !failed && (
            <button
              onClick={togglePlay}
              className="group absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-white/15 p-5 backdrop-blur hover:bg-white/25"
              aria-label={isPlaying ? "Pause" : "Play"}
              title={isPlaying ? "Pause" : "Play"}
            >
              <span className="relative inline-grid h-14 w-14 place-content-center rounded-full ring-2 ring-white/40 transition group-hover:ring-white/70">
                <span className="absolute inset-0 rounded-full bg-white/20 blur-2xl" />
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
          )}

          {/* No URL / failed note */}
          {!videoUrl && (
            <div className="absolute inset-0 grid place-items-center">
              <p className="rounded bg-white/80 px-3 py-1 text-xs text-slate-600 shadow">No preview available</p>
            </div>
          )}

          {/* subtle bottom gradient */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      </div>
    </div>
  );
}
