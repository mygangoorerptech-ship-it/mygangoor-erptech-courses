import { API_ROOT } from "./env";

let _cached: string | null = null;

function readCookie(name: string): string | null {
  const raw = typeof document !== "undefined" ? document.cookie : "";
  if (!raw) return null;
  for (const part of raw.split("; ")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const k = decodeURIComponent(part.slice(0, eq));
    if (k === name) return decodeURIComponent(part.slice(eq + 1));
  }
  return null;
}

export function getCsrfToken() { return _cached; }
export function invalidateCsrfToken() { _cached = null; }

/** Always hit API /csrf; fall back to cookie only for dev via Vite proxy */
export async function ensureCsrfToken(force = false): Promise<void> {
  if (!force && _cached) return;

  const url = API_ROOT ? `${API_ROOT}/csrf` : "/csrf";
  try {
    const res = await fetch(url, { credentials: "include" });
    let tok: string | null = null;
    try {
      const data: any = await res.json();
      tok = (data && (data.token || data.csrfToken)) || null;
    } catch {}
    if (!tok) tok = readCookie("__Host-csrf") || readCookie("csrf"); // dev fallback
    if (tok) _cached = tok;
  } catch {
    const tok = readCookie("__Host-csrf") || readCookie("csrf");
    if (tok) _cached = tok;
  }
}
