//backend/src/middleware/debug.js
export function reqLogger(label = "api") {
  return (req, res, next) => {
    const started = Date.now();
    const hdr = req.headers || {};
const haveSid = !!req.cookies?.sid;
const haveSr  = !!req.cookies?.sr;
    const authHdr = hdr.authorization ? `${hdr.authorization.slice(0, 20)}…` : "—";
    const csrfHdr = hdr["x-csrf-token"] ? "present" : "—";

    console.groupCollapsed(
      `%c[${label}] ${req.method} ${req.originalUrl}`,
      "color:#ea580c;font-weight:700"
    );
    console.log("origin:", hdr.origin);
    console.log("with cookies:", Object.keys(req.cookies || {}));
    console.log("sid:", haveSid, "sr:", haveSr);
    console.log("Authorization:", authHdr);
    console.log("X-CSRF-Token:", csrfHdr);

    res.on("finish", () => {
      console.log(`← ${res.statusCode} (${Date.now() - started}ms)`);
      console.groupEnd();
    });
    next();
  };
}
