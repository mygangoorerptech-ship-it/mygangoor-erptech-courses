// backend/src/utils/cookies.js

// ---------------------------------------------------------------------------
// PHASE 6: parseTtlMs — emits a warning on invalid TTL so misconfiguration
// is caught at startup rather than failing silently with a wrong maxAge.
// ---------------------------------------------------------------------------
function parseTtlMs(ttl) {
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
  // PHASE 1: variable order — compute in strict dependency sequence.
  // useHostPrefix must be known BEFORE sameSite so Phase 2 can use it.
  //
  // ORDER:
  //   1. viaHttps
  //   2. secure
  //   3. useHostPrefix
  //   4. sameSite logic
  // -----------------------------------------------------------------

  // 1. viaHttps — HTTPS detection, works behind Cloudflare / Nginx proxy.
  const viaHttps =
    req?.secure === true ||
    String(req?.headers?.["x-forwarded-proto"] || "").toLowerCase().includes("https");

  // 2. secure
  const secure = !!viaHttps;

  // 3. useHostPrefix — purely HTTPS-driven; __Host-* is a browser security
  // feature (requires Secure + Path=/ + no Domain), so it applies whenever
  // the request arrived over HTTPS regardless of NODE_ENV.
  // Previous value was `secure && !isDev`; the !isDev guard is removed
  // so that HTTPS dev environments also benefit from __Host-* protection.
/**
 * Production-safe cookie naming
 *
 * Always use standard cookie names.
 * Do NOT use __Host-* cookies because browser prefix rules
 * are causing production rejection and unstable auth.
 */
const sessionName = "sid";
const refreshName = "sr";

  // 4. PHASE 2: production-grade SameSite policy.
  //    HTTPS (useHostPrefix=true) → "strict": strongest standard, no
  //    cross-site leakage. HTTP / cross-site → preserve existing lax/none.
const wantsCrossSite = process.env.CROSS_SITE === "1";

/**
 * Production rule:
 *
 * Vercel frontend ↔ Render backend = cross-site cookies
 *
 * Must use:
 *   SameSite=None
 *   Secure=true
 *
 * Never use SameSite=Strict for auth cookies here,
 * otherwise browser rejects cookies and auth breaks.
 */
let sameSite = wantsCrossSite ? "none" : "lax";

/**
 * Browser safety:
 * SameSite=None requires Secure=true
 */
if (sameSite === "none" && !secure) {
  sameSite = "lax";
}

  const base = {
    httpOnly: true,
    secure,
    sameSite,
    path: "/", // no Domain attribute — qualifies for __Host-* in prod
  };

if (process.env.DEBUG_AUTH === "1") {
  console.log("[cookies] setAuthCookies:", {
    viaHttps,
    secure,
    sameSite,
    sessionName,
    refreshName,
    accessTokenLength: accessToken?.length || 0,
    refreshTokenLength: refreshToken?.length || 0,
  });
}

const accessMaxAge = parseTtlMs(process.env.ACCESS_TTL || "1h");

const clearAllVariants = (name) => {
  res.clearCookie(name, {
    path: "/",
    sameSite: "lax",
    secure: false,
  });

  res.clearCookie(name, {
    path: "/",
    sameSite: "none",
    secure: true,
  });

  res.clearCookie(name, {
    path: "/", // covers strict / legacy variants
  });
};

/**
 * IMPORTANT:
 * Clear historical cookies FIRST.
 *
 * Never clear AFTER setting new cookies,
 * otherwise the browser immediately deletes
 * the fresh login session.
 */
clearAllVariants("sid");
clearAllVariants("sr");
clearAllVariants("__Host-session");
clearAllVariants("__Host-refresh");

/**
 * Now write fresh auth cookies
 */
res.cookie(sessionName, accessToken, {
  ...base,
  maxAge: accessMaxAge,
});

res.cookie(refreshName, refreshToken, {
  ...base,
  maxAge: parseTtlMs(process.env.REFRESH_TTL || "30d"),
});

  // -----------------------------------------------------------------
  // PHASE 4: dev-only access-token mirror.
  // Changed from `NODE_ENV !== "production"` to `DEBUG_AUTH === "1"`.
  // The access token MUST NOT be exposed in a readable cookie by default,
  // even in staging or non-production environments. Only expose it when
  // the operator explicitly enables debug mode.
  // -----------------------------------------------------------------
  if (process.env.DEBUG_AUTH === "1") {
    res.cookie("access", accessToken, {
      httpOnly: false, // intentionally readable by the SPA for dev tooling
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: accessMaxAge, // mirrors the JWT TTL (was hardcoded 1 h)
    });
  }
}

export function clearAuthCookies(res) {
  // PHASE 3: use 3-variant clearing across all cookie names so deletion
  // succeeds regardless of which attribute set was used when the cookie
  // was originally written (lax, none+secure, or strict from Phase 2).
  const clear = (name) => {
    res.clearCookie(name, { path: "/", sameSite: "lax",   secure: false });
    res.clearCookie(name, { path: "/", sameSite: "none",  secure: true  });
    res.clearCookie(name, { path: "/" }); // covers SameSite=Strict
  };

  clear("__Host-session");
  clear("__Host-refresh");
  clear("sid");
  clear("sr");
  clear("access");
}
