// mygf/src/pages/auth/Mfa.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { verifyMfa, resendEmailOtp, totpSetup, totpVerify } from "../../api/auth";
import { useAuth } from "../../auth/store";

type StateShape = {
  from?: string;
  mfa?: { method?: "otp" | "totp" };
  mfaTempToken?: string;
};

const STORAGE_KEY = "mfaSession";

 function routeForRole(role?: string){
   // 👇 superadmin goes to its own area
   if (role === "superadmin") return "/superadmin/overview";
   if (role === "admin") return "/admin/overview";
   if (role && role.startsWith("org")) return "/dashboard";
   if (role === "vendor") return "/dashboard";
   return "/dashboard";
 }

export default function Mfa() {
  const nav = useNavigate();
  const { state } = useLocation() as any; // keep consistent with SignIn/SignUp usage
  const [query] = useSearchParams();
  const { login: doLogin, verifyMfa: markVerified, hydrate } = useAuth();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  const setupCalled = useRef(false);

  // Prefer navigation state; fall back to sessionStorage; last resort: ?token=...
  const memState = useMemo<StateShape>(() => {
    const s = (state as StateShape | undefined) || {};
    if (s?.mfaTempToken) return s;

    const fromStorage = (() => {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as StateShape) : undefined;
      } catch {
        return undefined;
      }
    })();

    if (fromStorage?.mfaTempToken) return fromStorage;

    const token = query.get("token") || undefined;
    return token ? { mfaTempToken: token, mfa: { method: "otp" } } : {};
  }, [state, query]);

  const method = memState?.mfa?.method ?? "otp";
  const mfaTempToken = memState?.mfaTempToken;
  const from = memState?.from;

  useEffect(() => {
    // Persist the session (helps on hard refresh)
    if (mfaTempToken) {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ mfa: { method }, mfaTempToken, from })
      );
    }
  }, [mfaTempToken, method, from]);

  // For TOTP show a QR on first load — guard against double runs (StrictMode/HMR)
  useEffect(() => {
    if (method === "totp" && mfaTempToken && !setupCalled.current) {
      setupCalled.current = true;
      totpSetup(mfaTempToken)
        .then((r) => {
          if (r?.qrDataUrl) setQr(r.qrDataUrl);
          else throw new Error("No QR returned");
        })
        .catch((err: any) => {
          const msg =
            err?.response?.data?.message ||
            "Your MFA session is invalid or expired. Please sign in again.";
          setError(msg);
          sessionStorage.removeItem("mfaSession");
          // ❌ old: nav("/admin/login", { replace: true })
          // ✅ unified login route:
          setTimeout(() => nav("/login", { replace: true }), 1200);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, mfaTempToken]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaTempToken) {
      setError("Missing MFA session. Please login again.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res =
        method === "totp"
          ? await totpVerify({ code, mfaTempToken })
          : await verifyMfa({ code, method: "otp", mfaTempToken });

      if (res.ok && res.user && res.tokens) {
        // ✅ persist user + tokens so guards see you as authenticated
        doLogin({ user: res.user, tokens: res.tokens });
        markVerified();
        // Re-hydrate from /auth/check so guards definitely see the session
        await hydrate();
        sessionStorage.removeItem(STORAGE_KEY);

        const base = routeForRole(res.user.role);
        const to = from && String(from).startsWith(base) ? from : base;
        nav(to, { replace: true });
      } else {
        setError(res.message || "Invalid code. Try again.");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!mfaTempToken) return;
    setLoading(true);
    setError(null);
    try {
      await resendEmailOtp(mfaTempToken);
    } catch {
      setError("Failed to resend. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-6 space-y-4">
        <h1 className="text-xl font-semibold">Multi-Factor Authentication</h1>
        <p className="text-sm text-gray-600">
          {method === "otp"
            ? "Enter the one-time code we sent to your email."
            : "Scan the QR in your authenticator app and then enter the 6-digit code."}
        </p>

        {method === "totp" && qr && (
          <div className="flex justify-center">
            <img src={qr} alt="TOTP QR" className="w-48 h-48 rounded-lg border" />
          </div>
        )}

        <form noValidate onSubmit={handleVerify} className="space-y-3">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="^[0-9]{6}$"
            title="Enter the 6-digit code"
            maxLength={6}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Enter 6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full bg-black text-white px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Verify"}
          </button>
        </form>

        {method === "otp" && (
          <button
            onClick={handleResend}
            disabled={loading}
            className="w-full border px-4 py-2 rounded-lg"
          >
            Resend Code
          </button>
        )}
      </div>
    </div>
  );
}
