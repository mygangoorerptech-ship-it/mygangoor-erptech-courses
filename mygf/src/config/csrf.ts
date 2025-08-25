// src/config/csrf.ts
let csrfToken: string | null = null;

export async function ensureCsrfToken(force = false): Promise<void> {
  if (csrfToken && !force) return;
  try {
    // hit same-origin /csrf so cookie is set and we get the token
    const res = await fetch('/csrf', { credentials: 'include' });

    // be tolerant: token may come as JSON { token } or as plain text
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }

    csrfToken = (typeof data === 'string' ? data : data?.token) || null;
  } catch {
    csrfToken = null;
  }
}

export function getCsrfToken(): string {
  return csrfToken || '';
}

// optional helper if you ever want to clear it manually
export function resetCsrfToken(): void {
  csrfToken = null;
}
