// mygf/src/components/screens/SignUp.tsx
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import NavBar from "../home/NavBar";
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../../auth/store';
import { api } from '../../api/client';
import Footer from "../common/Footer";

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
  if (role === "vendor") return "/vendor";
  if (role === "student") return "/dashboard";
  return "/home";
}

type PrecheckResp = {
  mode: 'signin' | 'signup';
  reason?: string;
  mfa?: { required: boolean; method: 'otp' | 'totp' | null };
} | null;

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
  const [precheck, setPrecheck] = useState<PrecheckResp>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const validateForm = () => {
    const next = { username: '', email: '', password: '', confirmPassword: '' };
    let ok = true;

    if (!username.trim()) { next.username = 'Please enter a username.'; ok = false; }
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(email)) { next.email = 'Enter a valid email.'; ok = false; }
    if (password.length < 6) { next.password = 'Password must be at least 6 chars.'; ok = false; }
    if (password !== confirmPassword) { next.confirmPassword = 'Passwords do not match.'; ok = false; }

    setErrors(next);
    return ok;
  };

  async function runPrecheck(currentEmail: string) {
    const e = currentEmail.trim().toLowerCase();
    if (!e) { setPrecheck(null); return; }
    setChecking(true);
    setFormError(null);
    try {
      // Backend should return: { mode:'signin'|'signup', reason?, mfa? }
      const { data } = await api.get('/auth/precheck', { params: { email: e } });
      setPrecheck(data as PrecheckResp);
      return data as PrecheckResp;         // <-- return the value so caller can decide immediately
    } catch (err: any) {
      // If precheck is unavailable, allow signup flow to proceed
      const fallback = { mode: 'signup' } as PrecheckResp;
      setPrecheck(fallback);
      return fallback;
    } finally {
      setChecking(false);
    }
  }

  const handleSubmit = async () => {
    setFormError(null);
    if (!validateForm()) return;

    // Always verify the email status before signup (use the return to avoid state-race)
    const pc = await runPrecheck(email);
    if (pc?.mode === 'signin') {
      // Go to Sign In instead of attempting signup
      navigate('/login', { state: { email } });
      return;
    }

    try {
      // Only call the student signup endpoint; no legacy fallback that causes 404s
      const { data } = await api.post('/auth/signup-student', { name: username, email, password });

      // If backend returns user + tokens, persist and route by role
      if (data?.user && data?.tokens) {
        doLogin({ user: data.user, tokens: data.tokens });
        const base = routeForRole(data.user?.role);
        const from = state?.from && String(state.from).startsWith(base) ? state.from : base;
        navigate(from, { replace: true });
        return;
      }

      // Fallback: cookie-based session only (no tokens returned)
      const base = routeForRole(data?.user?.role);
      navigate(base, { replace: true });
    } catch (error: any) {
      // If the email was created elsewhere during the attempt, show “Go to Sign In”
      if (error?.response?.status === 409) {
        setPrecheck({ mode: 'signin', reason: 'Account already exists' });
        return;
      }
      alert(error?.response?.data?.message || 'Sign-up failed');
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
          <h1 className="text-2xl font-semibold text-slate-900">Create your account</h1>
          <p className="text-sm text-slate-600 mt-1">Join and start learning today.</p>

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
                <label className="text-sm font-medium text-gray-700">Username</label>
                <div className="mt-1 relative group">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600">
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
                  />
                  <div className="pointer-events-none absolute -bottom-px left-0 right-0 h-px bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 opacity-80 group-focus-within:opacity-100" />
                </div>
                {errors.username && <p className="mt-1 text-xs text-red-600">{errors.username}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="text-sm font-medium text-gray-700">Email</label>
                <div className="mt-1 relative group">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600">
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
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => runPrecheck(email)}
                    autoComplete="email"
                  />
                  <div className="pointer-events-none absolute -bottom-px left-0 right-0 h-px bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 opacity-80 group-focus-within:opacity-100" />
                </div>
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
              </div>
            </div>

            {/* Row 2: Password + Confirm Password */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Password */}
              <div>
                <label className="text-sm font-medium text-gray-700">Password</label>
                <div className="mt-1 relative group">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600">
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
                <label className="text-sm font-medium text-gray-700">Confirm Password</label>
                <div className="mt-1 relative group">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600">
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
              onClick={handleSubmit}
              disabled={checking}
              className="w-full relative font-semibold py-2.5 rounded-xl text-white transition shadow-lg bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 disabled:opacity-60"
            >
              {checking ? 'Checking…' : 'Sign Up'}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-2">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs text-slate-500">or</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            {/* Google Sign Up */}
            <div className="flex justify-center">
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
                    alert(err?.response?.data?.message || 'Google login failed');
                  }
                }}
                onError={() => { alert('Google Login Failed'); }}
              />
            </div>

            <p className="text-center text-sm text-slate-600">
              Already have an account?{' '}
              <button onClick={() => navigate('/login')} className="text-indigo-600 hover:text-indigo-700 underline-offset-2 hover:underline">
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>

      <Footer brandName="ECA Academy" tagline="Learn smarter. Build faster." />
    </>
  );
};

export default SignUp;
