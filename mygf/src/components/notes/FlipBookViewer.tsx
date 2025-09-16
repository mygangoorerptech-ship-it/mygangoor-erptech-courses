// src/components/notes/FlipBookViewer.tsx
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { getStudentNotePdfUrl } from "../../api/notes"; // <-- NEW

type Item = { id: string; title: string; kind: "rich" | "html" | "pdf"; html?: string; pdfUrl?: string };

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

  // Lazy-load libs
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const [{ default: ReactPageFlip }, pdfjs] = await Promise.all([
          import("react-pageflip"),
          import("pdfjs-dist"),
        ]);
        const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        if (!cancelled) {
          setPageFlip(ReactPageFlip);
          setPdfjsLib(pdfjs);
        }
      } catch (e) {
        if (!cancelled) setErr("Failed to load viewer libraries.");
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open || !pdfjsLib) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setErr(null);
      const out: ReactNode[] = [];

      try {
        for (const n of notes) {
          const kind = n.kind === "html" ? "rich" : n.kind; // compatibility

          if (kind === "rich") {
            out.push(
              <article key={n.id} className="p-8 bg-white min-h-[580px] w-[420px]">
                <h2 className="text-xl font-semibold mb-3">{n.title}</h2>
                <div
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: n.html || "" }}
                />
              </article>
            );
          } else if (kind === "pdf") {
            // Always fetch a fresh signed URL (works for both public & authenticated assets)
  const { url } = await getStudentNotePdfUrl(n.id);   // <- destructure
  const loadingTask = pdfjsLib.getDocument(url); 
            const pdfDoc = await loadingTask.promise;
            const count = pdfDoc.numPages;

            for (let i = 1; i <= count; i++) {
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
                    alt={`page ${i}`}
                    className="max-w-full max-h-full"
                  />
                </div>
              );
            }
          }
        }

        if (!cancelled) setPages(out);
      } catch (e: any) {
        if (!cancelled) setErr("Couldn’t render notes. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, pdfjsLib, notes]);

  // beneath the other hooks
useEffect(() => {
  if (!open) return;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [open, onClose]);


if (!open) return null;

const Book: any =
  PageFlip ??
  ((props: any) => <div className={props.className} style={props.style}>{props.children}</div>);

return (
  <div
    className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto"
    role="dialog"
    aria-modal="true"
    onClick={onClose} // click outside to close
  >
    <div
      className="relative mx-auto w-full max-w-[900px] bg-neutral-100 rounded-2xl shadow-2xl p-3 sm:p-4"
      style={{ maxHeight: "92svh" }}
      onClick={(e) => e.stopPropagation()} // don't close when clicking the card
    >
      {/* Close: inside on mobile, floats out on ≥sm so it matches desktop look */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 sm:-top-3 sm:-right-3 bg-white rounded-full shadow p-2"
        aria-label="Close notes"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="w-full">
        {/* Make the book responsive: shrink on phones, keep 420px on desktop */}
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
          <div className="mt-2 text-center text-xs text-slate-500">Preparing content…</div>
        )}
        {err && <div className="mt-2 text-center text-xs text-red-600">{err}</div>}

        {/* Extra big target on small screens */}
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
