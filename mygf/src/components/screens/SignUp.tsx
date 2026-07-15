// mygf/src/components/screens/SignUp.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import NavBar from "../home/NavBar";
// import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../../auth/store';
import { api } from '../../api/client';
import { ensureCsrfToken } from '../../config/csrf';
import Footer from "../common/Footer";
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

const AuthBackdrop: React.FC = () => (
  <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
    <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-tr from-sky-300/40 to-indigo-300/30 blur-3xl" />
    <div className="absolute -bottom-20 -right-16 h-80 w-80 rounded-full bg-gradient-to-tr from-indigo-200/40 to-fuchsia-200/30 blur-3xl" />
    <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.12),rgba(255,255,255,0))]" />
  </div>
);

// same helper used in SignIn
function routeForRole(role?: string) {
  if (role === "superadmin") return "/superadmin";
  if (role === "admin") return "/admin";
  if (role && role.startsWith("org")) return "/dashboard";
  if (role === "teacher") return "/teacher";
  if (role === "student") return "/dashboard";
  return "/home";
}

type PrecheckResult = {
  mode: 'signin' | 'signup';
  reason?: string;
  mfa?: { required: boolean; method: 'otp' | 'totp' | null };
};
type PrecheckResp = PrecheckResult | null;

const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useLocation() as any;            // <-- needed for deep-linking
  const { login: doLogin } = useAuth();              // <-- unified store

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [errors, setErrors] = useState({
    username: '', email: '', password: '', confirmPassword: ''
  });

  // NEW: precheck + gating
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [precheck, setPrecheck] = useState<PrecheckResp>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Precheck is advisory UX only. The signup POST + unique email index remain
  // the authoritative race-safe decision. Cache and join same-email requests so
  // blur, React StrictMode, and rapid focus changes cannot duplicate network work.
  const latestEmailRef = useRef('');
  const mountedRef = useRef(true);
  const precheckCacheRef = useRef(new Map<string, PrecheckResult>());
  const precheckInflightRef = useRef(new Map<string, Promise<PrecheckResp>>());

  useEffect(() => {
    mountedRef.current = true;
    // Signup is CSRF-protected. Warm the token while the user fills the form so
    // submission does not pay an avoidable serial GET /csrf round trip. The
    // axios interceptor uses the same single-flight promise as a fallback.
    void ensureCsrfToken();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const validateForm = () => {
    const next = {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    };

    let ok = true;

    const normalizedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();

    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!normalizedUsername) {
      next.username = 'Full name is required.';
      ok = false;
    } else if (normalizedUsername.length < 2) {
      next.username = 'Name must contain at least 2 characters.';
      ok = false;
    } else if (normalizedUsername.length > 80) {
      next.username = 'Name is too long.';
      ok = false;
    }

    if (!normalizedEmail) {
      next.email = 'Email address is required.';
      ok = false;
    } else if (!emailRx.test(normalizedEmail)) {
      next.email = 'Please enter a valid email address.';
      ok = false;
    }

    if (!normalizedPassword) {
      next.password = 'Password is required.';
      ok = false;
    } else if (normalizedPassword.length < 8) {
      next.password = 'Password must contain at least 8 characters.';
      ok = false;
    } else if (!/[A-Z]/.test(normalizedPassword)) {
      next.password = 'Password must contain at least one uppercase letter.';
      ok = false;
    } else if (!/[a-z]/.test(normalizedPassword)) {
      next.password = 'Password must contain at least one lowercase letter.';
      ok = false;
    } else if (!/\d/.test(normalizedPassword)) {
      next.password = 'Password must contain at least one number.';
      ok = false;
    }

    if (!confirmPassword.trim()) {
      next.confirmPassword = 'Please confirm your password.';
      ok = false;
    } else if (password !== confirmPassword) {
      next.confirmPassword = 'Passwords do not match.';
      ok = false;
    }

    setErrors(next);
    return ok;
  };

  async function runPrecheck(currentEmail: string): Promise<PrecheckResp> {
    const normalizedEmail = currentEmail.trim().toLowerCase();

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      if (mountedRef.current) setPrecheck(null);
      return null;
    }

    const cached = precheckCacheRef.current.get(normalizedEmail);
    if (cached) {
      if (mountedRef.current && latestEmailRef.current === normalizedEmail) {
        setPrecheck(cached);
      }
      return cached;
    }

    const inflight = precheckInflightRef.current.get(normalizedEmail);
    if (inflight) return inflight;

    if (mountedRef.current && latestEmailRef.current === normalizedEmail) {
      setChecking(true);
      setFormError(null);
    }
    let request: Promise<PrecheckResp>;
    request = (async () => {
      try {
        const { data } = await api.get<PrecheckResult>('/auth/precheck', {
          params: { email: normalizedEmail },
        });

        const cache = precheckCacheRef.current;
        cache.set(normalizedEmail, data);

        // Bound this component-local cache. It exists only to eliminate duplicate
        // form requests, not to become a long-lived account-enumeration cache.
        if (cache.size > 5) {
          const oldestKey = cache.keys().next().value as string | undefined;
          if (oldestKey) cache.delete(oldestKey);
        }

        if (mountedRef.current && latestEmailRef.current === normalizedEmail) {
          setPrecheck(data);
        }

        return data;
      } catch {
        // Availability precheck must never become a second hard dependency for
        // account creation. The authoritative signup endpoint handles duplicate
        // emails with a database unique index and a 409 response.
        return null;
      } finally {
        if (precheckInflightRef.current.get(normalizedEmail) === request) {
          precheckInflightRef.current.delete(normalizedEmail);
        }

        if (mountedRef.current && latestEmailRef.current === normalizedEmail) {
          setChecking(false);
        }
      }
    })();

    precheckInflightRef.current.set(normalizedEmail, request);
    return request;

  }

  const handleSubmit = async () => {
    if (submitting) return;

    setFormError(null);

    if (!validateForm()) return;

    setSubmitting(true);

    // Use only a completed same-email precheck. Never add another blocking
    // request before signup; the backend unique index is authoritative and
    // already returns 409 for duplicate/racing submissions.
    const normalizedEmail = email.trim().toLowerCase();
    const cachedPrecheck = precheckCacheRef.current.get(normalizedEmail) ?? null;

    if (cachedPrecheck?.mode === 'signin') {
      toast(
        'Account already exists. Please sign in.',
        {
          icon: 'ℹ️',
        }
      );
      setSubmitting(false);
      navigate('/login', { state: { email } });
      return;
    }

    try {
      // Only call the student signup endpoint; no legacy fallback that causes 404s
      const { data } = await api.post('/auth/signup-student', {
        name: username.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      // If backend returns user + tokens, persist and route by role
      if (data?.user && data?.tokens) {
        doLogin({ user: data.user, tokens: data.tokens });
        const base = routeForRole(data.user?.role);
        const from = state?.from && String(state.from).startsWith(base) ? state.from : base;
        setPrecheck(null);
        toast.success(
          'Account created successfully'
        );
        navigate(from, { replace: true });
        return;
      }

      // Fallback: cookie-based session only (no tokens returned)
      const base = routeForRole(data?.user?.role);
      setPrecheck(null);
      toast.success(
        'Account created successfully'
      );
      navigate(base, { replace: true });
    } catch (error: any) {
      console.error(error);

      if (error?.response?.status === 409) {
        const duplicateResult: PrecheckResult = {
          mode: 'signin',
          reason: 'Account already exists'
        };
        precheckCacheRef.current.set(email.trim().toLowerCase(), duplicateResult);
        setPrecheck(duplicateResult);

        toast(
          'Account already exists. Please sign in.',
          {
            icon: 'ℹ️',
          }
        );

        return;
      }

      const status =
        error?.response?.status;

      const message =
        error?.response?.data?.message;

      let finalMessage =
        'Unable to create account right now.';

      if (status === 409) {
        finalMessage =
          'An account with this email already exists.';
      } else if (status === 429) {
        finalMessage =
          'Too many attempts. Please wait before trying again.';
      } else if (message) {
        finalMessage = message;
      }

      setFormError(finalMessage);

      toast.error(finalMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <NavBar />
      <div
        className="relative flex items-center justify-center min-h-screen px-4
             pt-24 md:pt-28
             bg-gradient-to-b from-slate-50 via-sky-50 to-slate-100"
      >
        <AuthBackdrop />

        <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200/60 shadow-xl bg-white/80 backdrop-blur p-6">
          <h1 className="text-2xl font-semibold text-black">Create your account</h1>
          <p className="text-sm text-black mt-1">Join and start learning today.</p>

          {/* NEW: precheck banner (keeps visual style minimal) */}
          {precheck?.mode === 'signin' && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 text-sm">
              {precheck?.reason || 'This email is already provisioned or has a pending invitation.'}{' '}
              <button
                onClick={() => navigate('/login')}
                className="underline font-medium"
              >
                Go to Sign In
              </button>
              {precheck?.mfa?.required && (
                <div className="mt-1 text-xs text-amber-700">
                  Note: MFA is required ({(precheck.mfa.method || 'otp').toUpperCase()}).
                </div>
              )}
            </div>
          )}
          {formError && (
            <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800 text-sm">
              {formError}
            </div>
          )}

          <div className="mt-6 space-y-6">
            {/* Row 1: Username + Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Username */}
              <div>
                <label className="text-sm font-medium text-black">Username</label>
                <div className="mt-1 relative group">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="opacity-80">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M6 20a6 6 0 0 1 12 0" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    className="mt-1 w-full px-4 py-2 rounded-xl shadow-sm focus:ring-0 focus:outline-none pl-10 bg-transparent border-none"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    maxLength={80}
                  />
                  <div className="pointer-events-none absolute -bottom-px left-0 right-0 h-px bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 opacity-80 group-focus-within:opacity-100" />
                </div>
                {errors.username && <p className="mt-1 text-xs text-red-600">{errors.username}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="text-sm font-medium text-black">Email</label>
                <div className="mt-1 relative group">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="opacity-80">
                      <path d="M4 6h16v12H4z" />
                      <path d="m22 6-10 7L2 6" />
                    </svg>
                  </span>
                  <input
                    type="email"
                    className="mt-1 w-full px-4 py-2 rounded-xl shadow-sm focus:ring-0 focus:outline-none pl-10 bg-transparent border-none"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      const nextEmail = e.target.value;
                      const normalizedNextEmail = nextEmail.trim().toLowerCase();

                      setEmail(nextEmail);
                      latestEmailRef.current = normalizedNextEmail;

                      setFormError(null);
                      setPrecheck(precheckCacheRef.current.get(normalizedNextEmail) ?? null);
                    }}
                    onBlur={() => runPrecheck(email)}
                    autoComplete="email"
                    maxLength={254}
                  />
                  <div className="pointer-events-none absolute -bottom-px left-0 right-0 h-px bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 opacity-80 group-focus-within:opacity-100" />
                </div>
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
                {checking && !errors.email && (
                  <p className="mt-1 text-xs text-black">Checking account availability…</p>
                )}
              </div>
            </div>

            {/* Row 2: Password + Confirm Password */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Password */}
              <div>
                <label className="text-sm font-medium text-black">Password</label>
                <div className="mt-1 relative group">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="opacity-80">
                      <rect x="4" y="11" width="16" height="9" rx="2" />
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                  </span>
                  <input
                    type={passwordVisible ? 'text' : 'password'}
                    className="mt-1 w-full px-4 py-2 rounded-xl shadow-sm focus:ring-0 focus:outline-none pl-10 bg-transparent border-none"
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    maxLength={128}
                  />
                  <div className="pointer-events-none absolute -bottom-px left-0 right-0 h-px bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 opacity-80 group-focus-within:opacity-100" />
                </div>
                {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
                <div className="mt-1">
                  <button
                    type="button"
                    onClick={() => setPasswordVisible((v) => !v)}
                    className="text-xs text-indigo-600 hover:text-indigo-700 underline-offset-2 hover:underline"
                  >
                    {passwordVisible ? 'Hide' : 'Show'} password
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="text-sm font-medium text-black">Confirm Password</label>
                <div className="mt-1 relative group">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="opacity-80">
                      <rect x="4" y="11" width="16" height="9" rx="2" />
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                  </span>
                  <input
                    type={confirmPasswordVisible ? 'text' : 'password'}
                    className="mt-1 w-full px-4 py-2 rounded-xl shadow-sm focus:ring-0 focus:outline-none pl-10 bg-transparent border-none"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    maxLength={128}
                  />
                  <div className="pointer-events-none absolute -bottom-px left-0 right-0 h-px bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 opacity-80 group-focus-within:opacity-100" />
                </div>
                {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>}
                <div className="mt-1">
                  <button
                    type="button"
                    onClick={() => setConfirmPasswordVisible((v) => !v)}
                    className="text-xs text-indigo-600 hover:text-indigo-700 underline-offset-2 hover:underline"
                  >
                    {confirmPasswordVisible ? 'Hide' : 'Show'} password
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full relative font-semibold py-2.5 rounded-xl text-white transition shadow-lg bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2 justify-center">
                  <Loader2 className="animate-spin" size={18} />
                  Creating Account...
                </span>
              ) : 'Sign Up'}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-2">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs text-black">....</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            {/* Google Sign Up */}
            {/* <div className="flex justify-center">
              <GoogleLogin
                onSuccess={async (credentialResponse) => {
                  try {
                    const { data } = await api.post('/auth/google', { credential: credentialResponse.credential });
                    if (data?.user && data?.tokens) {
                      doLogin({ user: data.user, tokens: data.tokens });
                      const base = routeForRole(data.user?.role);
                      const from = state?.from && String(state.from).startsWith(base) ? state.from : base;
                      navigate(from, { replace: true });
                      return;
                    }
                    const base = routeForRole(data?.user?.role);
                    navigate(base, { replace: true });
                  } catch (err: any) {
                    toast.error(
  err?.response?.data?.message ||
  'Google login failed'
);
                  }
                }}
                onError={() => { toast.error(
  'Google Login Failed'
); }}
              />
            </div> */}

            <p className="text-center text-sm text-black">
              Already have an account?{' '}
              <button onClick={() => navigate('/login')} className="text-indigo-600 hover:text-indigo-700 underline-offset-2 hover:underline">
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
};

export default SignUp;
