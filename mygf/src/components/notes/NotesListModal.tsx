// src/components/notes/NotesListModal.tsx
//
// Lists ALL notes for a course so the student can pick one to read (opens the
// existing FlipBookViewer) or download (PDF only). This is a pure consumption
// UI — it does not fetch, create, or modify notes; it receives the already
// fetched list and delegates selection/download to the parent.
import { X, FileText, BookOpen, Download } from "lucide-react";
import type { StudentNote } from "../../api/notes";

export default function NotesListModal({
  open,
  onClose,
  notes,
  onSelect,
  onDownload,
}: {
  open: boolean;
  onClose: () => void;
  notes: StudentNote[];
  onSelect: (note: StudentNote) => void;
  onDownload: (note: StudentNote) => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative mx-auto w-full max-w-[560px] bg-white rounded-2xl shadow-2xl p-4 sm:p-6 mt-10"
        style={{ maxHeight: "92svh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 sm:-top-3 sm:-right-3 bg-white rounded-full shadow p-2"
          aria-label="Close notes list"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-lg font-semibold text-gray-800 mb-1">Course Notes</h2>
        <p className="text-xs text-gray-500 mb-4">
          Select a note to read it, or download PDFs.
        </p>

        {notes.length === 0 ? (
          <div className="text-sm text-gray-500 py-8 text-center">
            No notes available.
          </div>
        ) : (
          <ul className="space-y-2 max-h-[70svh] overflow-y-auto pr-1">
            {notes.map((note) => {
              const isPdf = note.kind === "pdf";
              return (
                <li
                  key={note.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:border-indigo-300 hover:bg-indigo-50/40 transition"
                >
                  <div className="shrink-0 grid place-items-center w-9 h-9 rounded-md bg-indigo-50 text-indigo-600">
                    {isPdf ? (
                      <FileText className="w-5 h-5" />
                    ) : (
                      <BookOpen className="w-5 h-5" />
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelect(note)}
                    className="flex-1 min-w-0 text-left"
                    title="Open note"
                  >
                    <div className="font-medium text-slate-800 truncate">
                      {note.title}
                    </div>
                    <div className="text-xs text-slate-500">
                      {isPdf ? "PDF" : "Text"}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelect(note)}
                    className="shrink-0 text-xs font-medium text-indigo-600 border border-indigo-200 rounded px-3 py-1.5 hover:bg-indigo-50"
                  >
                    Open
                  </button>

                  {isPdf && (
                    <button
                      type="button"
                      onClick={() => onDownload(note)}
                      title="Download PDF"
                      className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-slate-800 border border-slate-200 rounded px-3 py-1.5 hover:bg-slate-50"
                    >
                      <Download className="w-4 h-4" /> Download
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
