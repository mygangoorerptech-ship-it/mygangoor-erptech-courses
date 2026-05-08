// backend/src/utils/cookies.js

// ---------------------------------------------------------------------------
// parseTtlMs — converts a human-readable TTL string (e.g. "30d", "1h", "90s")
// to milliseconds. Emits a warning on invalid input so misconfiguration is
// caught at startup rather than failing silently with a wrong maxAge.
// ---------------------------------------------------------------------------
export function parseTtlMs(ttl) {
  const match = String(ttl || "").match(/^(\d+)(s|m|h|d)$/);
  if (!match) {
    console.warn("[cookies] Invalid TTL format (expected e.g. '30d', '1h'):", ttl);
    return 60 * 60 * 1000; // default 1 h
  }
  const n = parseInt(match[1], 10);
  const units = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return n * units[match[2]];
}

export function setAuthCookies(req, res, { accessToken, refreshToken }) {
  // -----------------------------------------------------------------
  // HTTPS detection — works behind Cloudflare / Nginx proxy.
  // -----------------------------------------------------------------
  const viaHttps =
    req?.secure === true ||
    String(req?.headers?.["x-forwarded-proto"] || "").toLowerCase().includes("https");

  const secure = !!viaHttps;

  /**
   * Canonical cookie names.
   *
   * Always use standard (non-prefixed) names. __Host-* was attempted but
   * causes production rejection and unstable auth due to browser prefix rules.
   */
  const sessionName = "sid";
  const refreshName = "sr";

  /**
   * SameSite policy:
   *
   * CROSS_SITE=1 → SameSite=None (required for Vercel ↔ Render cross-origin).
   * Otherwise → SameSite=Lax (same-origin proxy or direct same-site access).
   *
   * Browser safety rule: SameSite=None requires Secure=true.
   * If the connection is not HTTPS, fall back to lax to avoid browser rejection.
   */
  const wantsCrossSite = process.env.CROSS_SITE === "1";
  let sameSite = wantsCrossSite ? "none" : "lax";
  if (sameSite === "none" && !secure) {
    sameSite = "lax";
  }

  const base = {
    httpOnly: true,
    secure,
    sameSite,
    path: "/", // no Domain attribute — keeps deletion simple and avoids subdomain leakage
  };

  const accessMaxAge = parseTtlMs(process.env.ACCESS_TTL || "1h");

  // -----------------------------------------------------------------
  // Clear historical cookie variants FIRST, before writing new ones.
  //
  // WHY three variants per name:
  //   Browsers key cookie deletion on the exact attribute combination used
  //   when the cookie was originally written (sameSite, secure, path).
  //   A prior deploy may have used lax, none+secure, or strict. We clear
  //   all three so stale cookies from any previous attribute set are removed,
  //   preventing old sessions from interfering with the freshly issued one.
  //
  // WHY clear BEFORE setting:
  //   If we cleared after, the browser would receive both a deletion and a
  //   new Set-Cookie in the same response — deletion wins and the fresh
  //   cookie is immediately discarded.
  // -----------------------------------------------------------------
  const clearAllVariants = (name) => {
    res.clearCookie(name, { path: "/", sameSite: "lax", secure: false });
    res.clearCookie(name, { path: "/", sameSite: "none", secure: true });
    res.clearCookie(name, { path: "/" }); // covers SameSite=Strict / legacy
  };

  clearAllVariants("sid");
  clearAllVariants("sr");
  clearAllVariants("__Host-session");
  clearAllVariants("__Host-refresh");
  // Note: the legacy "access" debug cookie is never written anymore (DEBUG_AUTH
  // is disabled). No clearAllVariants("access") needed on the write path.

  // Write canonical auth cookies
  res.cookie(sessionName, accessToken, {
    ...base,
    maxAge: accessMaxAge,
  });

  res.cookie(refreshName, refreshToken, {
    ...base,
    maxAge: parseTtlMs(process.env.REFRESH_TTL || "30d"),
  });

  // DEBUG_AUTH debug mirror removed. The access token must remain in an
  // HttpOnly cookie only — never readable by client-side JavaScript.
}

export function clearAuthCookies(res) {
  // Use three-variant clearing across all canonical cookie names so deletion
  // succeeds regardless of which SameSite/Secure combination was originally
  // written (see setAuthCookies for the full explanation).
  const clear = (name) => {
    res.clearCookie(name, { path: "/", sameSite: "lax", secure: false });
    res.clearCookie(name, { path: "/", sameSite: "none", secure: true });
    res.clearCookie(name, { path: "/" }); // covers SameSite=Strict
  };

  // Clear legacy __Host-* names in case any browser still holds them
  // from a prior deploy that used the host-prefix scheme.
  clear("__Host-session");
  clear("__Host-refresh");

  // Canonical names
  clear("sid");
  clear("sr");

  // Clear the legacy debug "access" cookie on logout for any browsers that
  // may still hold it from a session created while DEBUG_AUTH=1 was active.
  res.clearCookie("access", { path: "/", sameSite: "lax", secure: false });
  res.clearCookie("access", { path: "/", sameSite: "none", secure: true });
  res.clearCookie("access", { path: "/" });

  res.clearCookie("accessToken", { path: "/", sameSite: "lax", secure: false });
  res.clearCookie("accessToken", { path: "/", sameSite: "none", secure: true });
  res.clearCookie("accessToken", { path: "/" });
}
