// mygf/src/admin/api/certificates.ts
import { api } from '../../api/client';

export async function listCertTemplates() {
  const r = await api.get('/cert-templates');
  return r.data;
}

export async function generateCertificate(payload: { templateId: string; studentId: string; courseId: string }) {
  try {
    const r = await api.post('/certificates/generate', payload, { responseType: 'blob' });
    return r.data;
  } catch (err) {
    // Log detailed error information to the console for debugging.
    console.error('generateCertificate API error:', err);
    throw err;
  }
}

// --- PDF fetcher for stored certificate URLs ---
// Returns a Blob and best-effort filename (Content-Disposition ➜ URL basename)
export async function fetchCertificateBlobFromUrl(url: string): Promise<{ blob: Blob; filename?: string }> {
  // data URL -> turn into Blob
  if (url.startsWith("data:")) {
    const res = await fetch(url);
    const blob = await res.blob();
    return { blob, filename: "certificate.pdf" };
  }

  const takeBasename = (u: string) => {
    try {
      const parsed = new URL(u, window.location.origin);
      const last = (parsed.pathname.split("/").pop() || "").trim();
      // only accept if it looks like a file with an extension
      if (/\.[a-z0-9]{2,8}$/i.test(last)) return last;
    } catch {}
    return undefined;
  };

  const isAbsolute = /^https?:\/\//i.test(url);

  if (isAbsolute) {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(`Failed to fetch certificate (${res.status})`);
    const cd = res.headers.get("Content-Disposition") || "";
    let filename = /filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i.exec(cd || "")?.[1] || /filename="?([^"]+)"?/i.exec(cd || "")?.[1];
    if (!filename) filename = takeBasename(url);
    const blob = await res.blob();
    return { blob, filename };
  }

  // Relative path (e.g. /api/uploads/abc.pdf) -> call through axios base /api
  const path = url.startsWith("/api/") ? url.slice(5) : url; // strip '/api/'
  const r = await api.get(`/${path.replace(/^\//, "")}`, { responseType: "blob" });
  // @ts-ignore
  const cd = r.headers?.["content-disposition"] as string | undefined;
  let filename =
    (cd && (/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i.exec(cd)?.[1] || /filename="?([^"]+)"?/i.exec(cd)?.[1])) ||
    takeBasename(url);
  return { blob: r.data as Blob, filename };
}
