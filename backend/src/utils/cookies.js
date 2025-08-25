// backend/src/utils/cookies.js
export function setAuthCookies(req, res, { accessToken, refreshToken }) {
  // Are we effectively on HTTPS at the edge?
  // Works behind proxies (Cloudflare, dev reverse proxies) and locally.
  const viaHttps =
    req?.secure === true ||
    String(req?.headers?.["x-forwarded-proto"] || "").toLowerCase().includes("https");

  // If you are serving frontend and backend from different sites/origins, set CROSS_SITE=1
  const wantsCrossSite = process.env.CROSS_SITE === "1";

  // Compute attributes
  let secure = !!viaHttps;                  // only mark Secure if the request reached us over HTTPS
  let sameSite = wantsCrossSite ? "none" : "lax";

  // Browsers REQUIRE Secure when SameSite=None, otherwise cookie is dropped.
  if (sameSite === "none" && !secure) {
    // Fall back to Lax in non-HTTPS situations to ensure cookies stick in dev.
    sameSite = "lax";
  }

  // Use __Host-* only when we can set Secure; in dev fallback to sid/sr so browser accepts them
  const useHostPrefix = secure; // __Host-* is valid only with Secure + Path=/ and no Domain
  const sessionName = useHostPrefix ? "__Host-session" : "sid";
  const refreshName = useHostPrefix ? "__Host-refresh" : "sr";

  const base = {
    httpOnly: true,
    secure,
    sameSite,  // 'lax' for same-site (dev) or 'none' for cross-site over HTTPS
    path: "/", // host-only cookie (no Domain) so it can qualify for __Host-* in prod
  };

  res.cookie(sessionName, accessToken, {
    ...base,
    maxAge: 15 * 60 * 1000, // 15m
  });

  res.cookie(refreshName, refreshToken, {
    ...base,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30d
  });
}

export function clearAuthCookies(res) {
  // Clear both prod (__Host-*) and dev (sid/sr) names.
  // Use both attribute combinations to ensure deletion regardless of how they were set.
  const clear = (name) => {
    // Cookies set without SameSite=None (typical dev)
    res.clearCookie(name, { path: "/", sameSite: "lax", secure: false });
    // Cookies set with SameSite=None; Secure (prod/cross-site)
    res.clearCookie(name, { path: "/", sameSite: "none", secure: true });
  };

  clear("__Host-session");
  clear("__Host-refresh");
  clear("sid");
  clear("sr");
}
