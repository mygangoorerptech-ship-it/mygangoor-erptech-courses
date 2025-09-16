// backend/src/utils/pdfRenderer.js
import os from 'node:os';

export async function renderHtmlToPdf(html, pdfOptions = {}) {
  const remoteUrl = (process.env.BROWSERLESS_URL || '').trim();
  const allowFallback = String(process.env.ALLOW_PDF_LOCAL_FALLBACK || '0') === '1';

  if (remoteUrl) {
    try {
      const buf = await renderViaBrowserless(remoteUrl, html, pdfOptions);
      // Basic sanity check
      if (!buf || buf.length < 1000) throw new Error('remote-pdf-empty');
      return buf;
    } catch (e) {
      const msg = (e?.message || '').toLowerCase();
      const isAuthish = /401|403/.test(msg);
      const isTooMany = /429/.test(msg);
      const isServer  = /5\d\d/.test(msg) || /ECONNREFUSED|ENOTFOUND|timed-out|fetch failed/.test(msg);

      if (allowFallback && (isAuthish || isTooMany || isServer)) {
        console.warn('[pdfRenderer] remote failed (%s), falling back to local Chromium', e?.message || e);
        return await renderViaLocal(html, pdfOptions);
      }
      throw e;
    }
  }

  // No remote configured: use local (dev)
  return await renderViaLocal(html, pdfOptions);
}

async function renderViaBrowserless(url, html, pdfOptions) {
  let endpoint = url.replace(/\/+$/, '');
  // Accept both base host and explicit /pdf
  if (!/\/pdf(\?|$)/.test(endpoint)) endpoint += '/pdf';

  const token = (process.env.BROWSERLESS_TOKEN || '').trim();

  // ?token=... if not already present
  const hasTokenInUrl = /[?&]token=/.test(endpoint);
  const qs = new URLSearchParams();
  if (token && !hasTokenInUrl) qs.set('token', token);
  const fullUrl = qs.toString() ? `${endpoint}?${qs.toString()}` : endpoint;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.PDF_RENDER_TIMEOUT_MS || 45000));

  const body = JSON.stringify({
    html,
    options: normalizePdfOptions(pdfOptions),
  });

  const headers = { 'Content-Type': 'application/json' };
  // Some deployments also accept Authorization: Bearer <token> (harmless if extra)
  if (token && !hasTokenInUrl) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(fullUrl, { method: 'POST', headers, body, signal: controller.signal });
  } catch (err) {
    clearTimeout(timeout);
    throw new Error(`remote-pdf-request-failed:${err?.name === 'AbortError' ? 'timed-out' : (err?.message || err)}`);
  }
  clearTimeout(timeout);

  if (!res.ok) {
    let txt = '';
    try { txt = await res.text(); } catch {}
    // Surface HTTP status in error for the caller / logs
    throw new Error(`remote-pdf-http-${res.status}:${(txt || '').slice(0, 300)}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

async function renderViaLocal(html, pdfOptions) {
  // Local fallback: dev-friendly Puppeteer
  const puppeteer = (await import('puppeteer')).default;
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return await page.pdf(normalizePdfOptions(pdfOptions));
  } finally {
    await browser.close();
  }
}

function normalizePdfOptions(user = {}) {
  const allowed = {
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    landscape: true,
    margin: undefined,
  };
  const out = { ...allowed };
  for (const k of Object.keys(user || {})) {
    if (Object.prototype.hasOwnProperty.call(allowed, k)) out[k] = user[k];
  }
  return out;
}
