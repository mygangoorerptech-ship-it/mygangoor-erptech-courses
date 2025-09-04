// src/config/csrf.ts
let _cached: string | null = null;

function readCookie(name: string) {
  const m = document.cookie.match(
    '(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'
  );
  return m ? decodeURIComponent(m[1]) : null;
}

export function getCsrfToken(): string | null {
  const hostTok = readCookie('__Host-csrf');
  const devTok = readCookie('csrf');
  const c = hostTok || devTok || null;
  if (c && c !== _cached) _cached = c;
  return _cached;
}

export function invalidateCsrfToken(): void {
  _cached = null;
}

/** Ensure we have a fresh CSRF cookie (no axios; avoids interceptor recursion) */
export async function ensureCsrfToken(force = false): Promise<void> {
  if (!force && getCsrfToken()) return;
  try {
    await fetch('/csrf', { credentials: 'include', method: 'GET' });
  } catch {
    // ignore; caller may still proceed with no token if BE accepts header-only from same-origin
  }
  getCsrfToken();
}
