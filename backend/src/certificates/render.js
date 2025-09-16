// backend/src/certificates/render.js
import fs from "fs";
import path from "path";
import Handlebars from "handlebars";
import dayjs from "dayjs";
import QRCode from "qrcode";
import { htmlToPdf } from "../utils/safePuppeteer.js";

// Helpers
Handlebars.registerHelper("upper", (s) => (s || "").toUpperCase());
Handlebars.registerHelper("formatDate", (d, fmt) => dayjs(d).format(fmt || "DD MMM YYYY"));

/**
 * Render a certificate template into a PDF Buffer.
 * Expects template.dir containing template.hbs (+ optional style.css).
 */
export async function renderCertificate(template, data) {
  if (!template?.dir) throw new Error("invalid-template");

  const htmlPath = path.join(template.dir, "template.hbs");
  if (!fs.existsSync(htmlPath)) throw new Error("template-missing");

  const cssPath = path.join(template.dir, "style.css");
  const htmlTpl = fs.readFileSync(htmlPath, "utf8");
  const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, "utf8") : "";

  // Escape user-provided strings to prevent HTML injection
  const safe = (v) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");

  // Embedded QR (no external network)
  const qrDataUrl = await QRCode.toDataURL(data.qrUrl || "about:blank");

  // Mild CSP to discourage unexpected loads (also blocked by request interception)
  const metaCsp =
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: blob:; style-src \'unsafe-inline\'; font-src data:;">';

  const compile = Handlebars.compile(htmlTpl, { noEscape: true });
  const html = compile({
    ...Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, typeof v === "string" ? safe(v) : v])),
    qrDataUrl,
  });

  const finalHtml = html.replace(/<head[^>]*>/i, (m) => `${m}\n${metaCsp}\n<style>${css}</style>`);

  const pdfBuffer = await htmlToPdf(finalHtml, {
    pdfOptions: {
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      landscape: true,
      margin: { top: "0.4in", right: "0.4in", bottom: "0.4in", left: "0.4in" },
    },
    // If you *must* load remote assets, allowlist domains via env:
    // PDF_ASSET_ALLOWLIST="https://res.cloudinary.com,https://fonts.gstatic.com"
    allowlist: (process.env.PDF_ASSET_ALLOWLIST || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  });

  return pdfBuffer;
}
