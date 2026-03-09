// src/components/notes/FlipBookViewer.tsx
import React, { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { API_BASE } from "../../config/env";

// ── Types ──────────────────────────────────────────────────────────────────────
// "html" was a legacy alias for "rich" that existed only in frontend types,
// never in the database (schema enforces "rich"|"pdf"). It is removed here.
type NoteKind = "rich" | "pdf";
type Item = { id: string; title: string; kind: NoteKind; html?: string };

// ── Error classification ───────────────────────────────────────────────────────
type ErrKind = "worker" | "auth" | "pdf-fetch" | "pdf-parse" | "generic";

function classifyError(e: unknown): ErrKind {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  if (msg.includes("worker") || msg.includes("workerport") || msg.includes("importscripts")) return "worker";
  if (msg.includes("401") || msg.includes("403") || msg.includes("unauthorized") || msg.includes("forbidden")) return "auth";
  if (msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("cors") || msg.includes("502") || msg.includes("504")) return "pdf-fetch";
  if (msg.includes("invalid pdf") || msg.includes("missing pdf") || msg.includes("unexpected")) return "pdf-parse";
  return "generic";
}

const ERR_MESSAGES: Record<ErrKind, string> = {
  worker:      "PDF viewer failed to initialise. Please refresh the page.",
  auth:        "You do not have permission to view this PDF. Please re-login.",
  "pdf-fetch": "Could not load the PDF file. Check your connection and try again.",
  "pdf-parse": "The PDF file appears to be corrupted or invalid.",
  generic:     "Could not render notes. Please try again.",
};

// ── Component ──────────────────────────────────────────────────────────────────
export default function FlipBookViewer({
  open,
  onClose,
  notes,
}: {
  open: boolean;
  onClose: () => void;
  notes: Item[];
}) {
  const [PageFlip, setPageFlip] = useState<any>(null);
  const [pdfjsLib, setPdfjsLib] = useState<any>(null);
  const [pages, setPages] = useState<ReactNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ── Lazy-load viewer libraries ────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const [{ default: ReactPageFlip }, pdfjs] = await Promise.all([
          import("react-pageflip"),
          import("pdfjs-dist"),
        ]);

        // Phase 1 fix: use the static worker file copied to /public at build time.
        // The previous `new URL("pdfjs-dist/...", import.meta.url)` pattern fails
        // in Vite production builds because the worker asset is not automatically
        // included in the output bundle without explicit Vite plugin configuration.
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

        if (!cancelled) {
          setPageFlip(ReactPageFlip);
          setPdfjsLib(pdfjs);
        }
      } catch (e) {
        console.error("[FlipBookViewer] lib load error:", e);
        if (!cancelled) setErr(ERR_MESSAGES.worker);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  // ── Render all notes into flipbook pages ──────────────────────────────────
  useEffect(() => {
    if (!open || !pdfjsLib) return;
    if (!notes.length) { setPages([]); setLoading(false); return; }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      const out: ReactNode[] = [];

      try {
        for (const n of notes) {
          if (n.kind === "rich") {
            // ── Rich text → single article page ──────────────────────────
            out.push(
              <article key={n.id} className="p-8 bg-white min-h-[580px] w-[420px]">
                <h2 className="text-xl font-semibold mb-3">{n.title}</h2>
                <div
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: n.html || "" }}
                />
              </article>
            );
          } else if (n.kind === "pdf") {
            // ── PDF → one canvas page per PDF page ───────────────────────
            //
            // Phase 8 fix: fetch through the backend stream endpoint instead of
            // presigning a Cloudinary URL and fetching directly from the CDN.
            //
            // Why this matters in production:
            //   - Direct browser→Cloudinary requests require Cloudinary CORS to
            //     allow the frontend domain. The backend proxy sidesteps this
            //     entirely — the browser talks to our own origin.
            //   - Auth cookies are forwarded to our backend (same domain), not
            //     exposed to a third-party CDN.
            //   - No signed-URL TTL race conditions.
            //
            // Backend endpoint: GET /api/student/notes/pdf/:id
            const streamUrl = `${API_BASE}/student/notes/pdf/${n.id}`;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let pdfDoc: Record<string, any>;
            try {
              pdfDoc = await pdfjsLib.getDocument({
                url: streamUrl,
                withCredentials: true, // send httpOnly session cookie to backend
              }).promise;
            } catch (e) {
              const kind = classifyError(e);
              console.error(`[FlipBookViewer] PDF load failed (${kind}) for note "${n.title}":`, e);
              // Throw with a user-friendly message already attached
              throw Object.assign(new Error(ERR_MESSAGES[kind]), { _kind: kind });
            }

            for (let i = 1; i <= pdfDoc.numPages; i++) {
              const page = await pdfDoc.getPage(i);
              const viewport = page.getViewport({ scale: 1.4 });
              const canvas = document.createElement("canvas");
              const ctx = canvas.getContext("2d")!;
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              await page.render({ canvasContext: ctx, viewport }).promise;

              out.push(
                <div
                  key={`${n.id}-p${i}`}
                  className="bg-white w-[420px] min-h-[580px] grid place-items-center p-3"
                >
                  <img
                    src={canvas.toDataURL("image/png")}
                    alt={`${n.title} — page ${i}`}
                    className="max-w-full max-h-full"
                  />
                </div>
              );
            }
          }
        }

        if (!cancelled) setPages(out);
      } catch (e) {
        // Use the pre-classified message if available, otherwise classify now
        const raw = e instanceof Error ? e.message : "";
        const msg = Object.values(ERR_MESSAGES).includes(raw)
          ? raw
          : ERR_MESSAGES[classifyError(e)];
        console.error("[FlipBookViewer] render pipeline error:", e);
        if (!cancelled) setErr(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, pdfjsLib, notes]);

  // ── Keyboard escape ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  // PageFlip is dynamically imported; type-cast to avoid strict-any lint errors
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Book = (PageFlip as React.ComponentType<any>) ??
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((props: Record<string, any>) => (
      <div className={props.className} style={props.style}>
        {props.children}
      </div>
    ));

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative mx-auto w-full max-w-[900px] bg-neutral-100 rounded-2xl shadow-2xl p-3 sm:p-4"
        style={{ maxHeight: "92svh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 sm:-top-3 sm:-right-3 bg-white rounded-full shadow p-2"
          aria-label="Close notes"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-full">
          <Book
            width={420}
            height={580}
            className="mx-auto shadow-xl w-[420px] max-w-[88vw] h-auto"
          >
            {pages}
          </Book>

          <div className="mt-2 text-center text-xs text-slate-600 select-none">
            Swipe / drag or click to turn pages →
          </div>

          {loading && (
            <div className="mt-2 text-center text-xs text-slate-500">
              Preparing content…
            </div>
          )}
          {err && (
            <div className="mt-2 text-center text-xs text-red-600">{err}</div>
          )}

          <div className="sm:hidden mt-3 flex justify-center">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 text-white"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
