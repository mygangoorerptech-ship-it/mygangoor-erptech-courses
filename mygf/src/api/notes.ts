// src/api/notes.ts
import { api } from "../config/api";

export type StudentNote = {
  id: string;                // server may send _id; we normalize below
  _id?: string;
  title: string;
  kind: "rich" | "html" | "pdf";
  html?: string;
  pdfUrl?: string;           // may be public OR ignored if we use signed URL
  createdAt: string;
};

export async function listStudentNotes(courseId: string) {
  // IMPORTANT: pass the real course ObjectId, e.g. course._id (NOT the title)
  const { data } = await api.get("/student/notes", { params: { courseId } });
  // normalize id
  const items = (Array.isArray(data) ? data : []) as StudentNote[];
  return items.map(n => ({ ...n, id: n.id || (n as any)._id })) as StudentNote[];
}

// Short-lived signed URL for authenticated Cloudinary PDFs

export async function getStudentNotePdfUrl(id: string, ttl = 3600): Promise<{ url: string; ttl: number }> {
  const { data } = await api.get('/student/notes/presign', { params: { id, ttl } });
  return data;
}