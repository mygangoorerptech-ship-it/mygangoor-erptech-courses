// backend/src/utils/safePuppeteer.js
import chromium from "@sparticuz/chromium";
let cachedBrowser = null;

/**
 * Launch a Puppeteer-compatible browser that works:
 *  - locally: full `puppeteer`
 *  - on Render: `puppeteer-core` + `@sparticuz/chromium`
 */
export async function launchBrowser() {
  if (cachedBrowser) return cachedBrowser;

  const isRender = !!(process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.RENDER_INTERNAL_HOSTNAME);
  const forceCore = process.env.PUPPETEER_CORE === "1" || process.env.PUPPETEER_CORE === "true";

  try {
    if (isRender || forceCore) {
      const puppeteer = await import("puppeteer-core");
      const executablePath = await chromium.executablePath();
      cachedBrowser = await puppeteer.launch({
        args: [
          ...chromium.args,
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
        defaultViewport: chromium.defaultViewport ?? { width: 1280, height: 720, deviceScaleFactor: 1 },
        executablePath,
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
      });
      return cachedBrowser;
    }

    // Dev fallback: full puppeteer (same local dev behavior)
    const puppeteer = await import("puppeteer");
    cachedBrowser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    return cachedBrowser;
  } catch (err) {
    // Last-resort: try core+chromium even in dev
    const puppeteer = await import("puppeteer-core");
    const executablePath = await chromium.executablePath();
    cachedBrowser = await puppeteer.launch({
      args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
      defaultViewport: chromium.defaultViewport ?? { width: 1280, height: 720, deviceScaleFactor: 1 },
      executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });
    return cachedBrowser;
  }
}

/** Convert an HTML string to PDF (Buffer) with strict request interception. */
export async function htmlToPdf(html, { pdfOptions = {}, allowlist = [] } = {}) {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  // Block *all* external requests by default (defense-in-depth)
  const allow = Array.isArray(allowlist) ? allowlist : [];
  const allowRegex = new RegExp(
    `^(data:|blob:|about:blank${allow.length ? "|" + allow.map(s => s.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")).join("|") : ""})`,
    "i"
  );
  await page.setRequestInterception(true);
  page.on("request", (req) => (allowRegex.test(req.url()) ? req.continue() : req.abort()));

  await page.setContent(html, { waitUntil: "networkidle0" });
  const buffer = await page.pdf({
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    ...pdfOptions,
  });
  await page.close();
  return buffer;
}
