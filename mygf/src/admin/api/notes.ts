// src/admin/api/notes.ts
import { api } from "./client";

export type NoteStatus = "draft" | "published" | "archived";
export type NoteKind = "rich" | "pdf";

export type Note = {
  id: string;
  orgId: string | null;
  courseId: string;         // server resolves slug/title/ObjectId
  ownerId: string;
  title: string;
  kind: NoteKind;
  html?: string;
  pdfUrl?: string;
  pdfPublicId?: string;
  status: NoteStatus;
  createdAt: string;
  updatedAt: string;
};

// GET /api/notes?courseId=<id|slug|title>&status=all|draft|published|archived
export async function listNotes(opts: { courseId?: string; status?: "all" | NoteStatus } = {}) {
  const { data } = await api.get("/notes", {
    params: {
      courseId: opts.courseId ?? "all",
      status: opts.status ?? "all",
    },
  });
  return data as Note[];
}

// POST /api/notes
export async function createNote(payload: {
  courseId: string;          // id | slug | exact title (backend supports all)
  title: string;
  kind: NoteKind;
  html?: string;
  pdfUrl?: string;
  pdfPublicId?: string;
  status?: NoteStatus;       // defaults to "published" on server if omitted
}) {
  const { data } = await api.post("/notes", payload);
  return data as Note;
}

// PATCH /api/notes/:id
export async function updateNote(
  id: string,
  payload: Partial<Pick<Note, "title" | "status" | "html">>
) {
  const { data } = await api.patch(`/notes/${id}`, payload);
  return data as Note;
}

// POST /api/notes/:id/status
export async function setNoteStatus(id: string, status: NoteStatus) {
  const { data } = await api.post(`/notes/${id}/status`, { status });
  return data as Note;
}

// DELETE /api/notes/:id
export async function deleteNote(id: string) {
  const { data } = await api.delete(`/notes/${id}`);
  return data as { ok: boolean };
}

// POST /api/uploads/pdf  (multipart/form-data; field name "file")
export async function uploadPdf(file: File) {
  const form = new FormData();
  form.append("file", file);
  // Do NOT set Content-Type; let the browser/axios set the boundary
  const { data } = await api.post("/uploads/pdf", form);
  // { ok: true, url: string, publicId: string }
  return data as { ok: boolean; url: string; publicId: string };
}
