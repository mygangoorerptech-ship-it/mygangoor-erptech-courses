//backend/src/certificates/render.js
import fs from "fs";
import path from "path";
import Handlebars from "handlebars";
import dayjs from "dayjs";
import QRCode from "qrcode";
import puppeteer from "puppeteer";

// Register helpers on first import
Handlebars.registerHelper("upper", (s) => (s || "").toUpperCase());
Handlebars.registerHelper("formatDate", (d, fmt) => dayjs(d).format(fmt || "DD MMM YYYY"));

/**
 * Render a certificate template using Puppeteer. The template must have
 * been loaded via registry, exposing a `dir` property. It is expected
 * to contain at least a `template.hbs`. Optionally, a `style.css` may
 * accompany the template; it will be inlined. A QR code is generated
 * automatically from the provided `qrUrl` in the data, or a default
 * placeholder if omitted.
 *
 * @param {Object} opts
 * @param {Object} opts.template Template metadata object with `dir`.
 * @param {Object} opts.data Values to inject into the Handlebars template.
 * @returns {Promise<Buffer>} A PDF buffer
 */
export async function renderCertificate({ template, data }) {
  // Generate a QR code data URL. If no qrUrl is provided, use a
  // placeholder link.
  const qrDataUrl = await QRCode.toDataURL(data.qrUrl || "https://example.com/verify");
  const htmlPath = path.join(template.dir, "template.hbs");
  const cssPath = path.join(template.dir, "style.css");
  const htmlTpl = fs.readFileSync(htmlPath, "utf8");
  const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, "utf8") : "";
  const compile = Handlebars.compile(htmlTpl);
  const html = compile({ ...data, qrDataUrl });
  // Inline external CSS into the head of the document for Puppeteer
  const finalHtml = html.replace(/<\/head>/i, `<style>${css}</style></head>`);
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setContent(finalHtml, { waitUntil: "networkidle0" });
  // Render the document as a PDF. A4 landscape is the common format for
  // certificates; adjust the format or layout as needed.
  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    landscape: true,
  });
  await browser.close();
  return pdfBuffer;
}