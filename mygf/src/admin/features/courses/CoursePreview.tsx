// mygf/src/admin/features/courses/CoursePreview.tsx
import React, { useEffect, useMemo, useState } from "react";
import Modal from "../../components/Modal";
import Button from "../../components/Button";
import { Play, ChevronLeft, ChevronRight } from "lucide-react";
import type { Chapter } from "../../types/course";

export function PreviewButton({ chapters }: { chapters: Chapter[] }) {
  const [open, setOpen] = useState(false);
  if (!chapters?.length) return null;
  return (
    <>
      <Button
        variant="ghost"
        className="h-8 px-2 text-xs"
        onClick={() => setOpen(true)}
        title="Preview"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
          <path d="M12 5c-5 0-9 4.5-10 7 1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z" />
        </svg>
      </Button>
      {open && (
        <ChaptersPreviewModal chapters={chapters} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

export function ChaptersPreviewModal({
  chapters,
  onClose,
}: {
  chapters: Chapter[];
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const c = chapters[idx];

  const next = () => setIdx((i) => (i + 1) % chapters.length);
  const prev = () => setIdx((i) => (i - 1 + chapters.length) % chapters.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []); // eslint-disable-line

  const hasMedia = !!(c?.coverUrl || c?.youtubeUrl || c?.videoUrl);

  const Media: React.FC = () => (
    <div
      className="relative w-full overflow-hidden rounded-2xl bg-slate-100 shadow-sm"
      style={{ aspectRatio: "16 / 9" }}
    >
      {c?.coverUrl ? (
        <img
          src={c.coverUrl}
          alt={c.title || "cover"}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : hasMedia ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/60 text-white">
          <Play className="h-7 w-7" />
          <div className="text-xs opacity-90">Preview video</div>
        </div>
      ) : (
        <div className="absolute inset-0 grid place-items-center text-slate-500 text-sm">
          No media
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/15 to-transparent" />
    </div>
  );

  const dots = useMemo(
    () =>
      chapters.map((_, i) => (
        <button
          key={i}
          onClick={() => setIdx(i)}
          className={`h-1.5 w-5 rounded-full transition-all ${
            i === idx ? "bg-slate-900" : "bg-slate-300 hover:bg-slate-400"
          }`}
          aria-label={`Go to chapter ${i + 1}`}
        />
      )),
    [chapters, idx]
  );

  const DESC_LIMIT = 200;
  const [descExpanded, setDescExpanded] = useState(false);
  const description = c?.description || "";
  const showToggle = description.length > DESC_LIMIT;
  const shown = descExpanded ? description : description.slice(0, DESC_LIMIT);

  return (
    <Modal open title="Course Preview" onClose={onClose} size="lg">
      {/* Clamp to viewport width to avoid horizontal scrollbars */}
      <div
        className="w-full"
        style={{ width: "min(92vw, 1100px)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 pb-3">
          <div className="min-w-0 truncate text-sm text-slate-600">
            <span className="font-medium text-slate-800">
              Chapter {idx + 1} / {chapters.length}
            </span>{" "}
            — <span className="truncate">{c?.title || "Untitled"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              className="h-8 w-8 rounded-full p-0"
              onClick={prev}
              title="Previous chapter"
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              variant="secondary"
              className="h-8 w-8 rounded-full p-0"
              onClick={next}
              title="Next chapter"
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="grid gap-6 md:grid-cols-[1.25fr_1fr]">
          {/* Media */}
          <div className="min-w-0">
            <Media />
            {/* Thumbnails */}
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex flex-1 items-center gap-2 overflow-x-auto overscroll-contain scroll-smooth">
                {chapters.map((ch, i) => (
                  <button
                    key={i}
                    onClick={() => setIdx(i)}
                    className={`relative h-14 w-24 shrink-0 overflow-hidden rounded-lg border transition-all ${
                      i === idx
                        ? "border-slate-800 ring-2 ring-slate-800/20"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                    title={ch.title || `Chapter ${i + 1}`}
                  >
                    {ch.coverUrl ? (
                      <img
                        src={ch.coverUrl}
                        className="h-full w-full object-cover"
                        alt=""
                        loading="lazy"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-slate-100 text-[11px] text-slate-500">
                        {ch.title?.slice(0, 10) || `#${i + 1}`}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 hidden justify-center gap-1.5 md:flex">
              {dots}
            </div>
          </div>

          {/* Info */}
          <div className="min-w-0">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold leading-tight">
                {c?.title || "Untitled"}
              </h3>
              {c?.subtitle && (
                <div className="text-sm text-slate-600">{c.subtitle}</div>
              )}

              {/* Description: justified + Read more/less */}
              {description && (
                <div className="relative">
                  <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line break-words text-justify">
                    {shown}
                  </p>
                  {!descExpanded && showToggle && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-white/0" />
                  )}
                  {showToggle && (
                    <button
                      type="button"
                      onClick={() => setDescExpanded((s) => !s)}
                      className="mt-1 inline-flex items-center rounded px-2 py-1 text-xs font-medium text-sky-700 hover:text-sky-800 hover:underline"
                    >
                      {descExpanded ? "Read less" : "Read more"}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <span>
                Rating: {(c?.avgRating ?? 0).toFixed(1)} / 5 •{" "}
                {c?.reviewsCount ?? 0} reviews
              </span>
            </div>

            {!!c?.assignments?.length && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-xs font-semibold text-slate-700">
                  Assignments
                </div>
                <ul className="list-disc space-y-1 pl-5 text-xs text-slate-700">
                  {c.assignments!.map((a, i) => (
                    <li key={a.id || i}>
                      {a.title}
                      {a.link ? (
                        <>
                          {" "}
                          —{" "}
                          <a
                            className="text-sky-600 underline"
                            href={a.link}
                            target="_blank"
                            rel="noreferrer"
                          >
                            link
                          </a>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
