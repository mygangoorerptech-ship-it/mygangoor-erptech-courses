// backend/src/utils/cookies.js

// Parse a JWT-style TTL string ("15m", "1h", "30d") into milliseconds.
// Falls back to 1 hour so behaviour is unchanged if ACCESS_TTL is not set.
function parseTtlMs(ttl) {
  const match = String(ttl || "").match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 60 * 60 * 1000; // default 1 h
  const n = parseInt(match[1], 10);
  const units = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return n * units[match[2]];
}

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

  // In development, always use non-Host prefixed cookies to avoid issues
  const isDev = process.env.NODE_ENV !== "production";
  const useHostPrefix = secure && !isDev; // __Host-* is valid only with Secure + Path=/ and no Domain
  const sessionName = useHostPrefix ? "__Host-session" : "sid";
  const refreshName = useHostPrefix ? "__Host-refresh" : "sr";

  const base = {
    httpOnly: true,
    secure,
    sameSite,  // 'lax' for same-site (dev) or 'none' for cross-site over HTTPS
    path: "/", // host-only cookie (no Domain) so it can qualify for __Host-* in prod
  };

  // Debug logging for cookie setting
  if (process.env.DEBUG_AUTH === "1") {
    console.log("[cookies] Setting auth cookies:", {
      viaHttps,
      secure,
      sameSite,
      isDev,
      useHostPrefix,
      sessionName,
      refreshName,
      accessTokenLength: accessToken?.length || 0,
      refreshTokenLength: refreshToken?.length || 0
    });
  }

  // Derive cookie maxAge from the same ACCESS_TTL env var used to sign the JWT,
  // so the cookie and the token expire at the same time.
  const accessMaxAge = parseTtlMs(process.env.ACCESS_TTL || "1h");

  res.cookie(sessionName, accessToken, {
    ...base,
    maxAge: accessMaxAge,
  });

  res.cookie(refreshName, refreshToken, {
    ...base,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days (refresh token TTL)
  });

    // DEV-ONLY: mirror the access token into a readable cookie so the SPA can send Authorization 
  // Never enable this in production. 
  if (process.env.NODE_ENV !== "production") { 
    res.cookie("access", accessToken, { 
      httpOnly: false,          // readable by frontend 
      secure: false,            // dev http/https both OK 
      sameSite: "lax", 
      path: "/", 
      maxAge: 60 * 60 * 1000, // 1 hour (access token TTL)
    }); 
  }
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
  clear("access");
}
