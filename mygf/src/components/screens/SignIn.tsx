// mygf/src/components/screens/SignIn.tsx
import React, { useEffect, useState } from 'react';
import NavBar from "../home/NavBar";
import { useNavigate, useLocation } from 'react-router-dom';
import Footer from "../common/Footer";
import { useAuth } from '../../auth/store';
import { api } from '../../api/client';
import { ensureCsrfToken, getCsrfToken } from '../../config/csrf';
import { GoogleLogin } from '@react-oauth/google';

function routeForRole(role?: string) {
  if (role === "superadmin") return "/superadmin";
  if (role === "admin") return "/admin";
  if (role && role.startsWith("org")) return "/dashboard";
  if (role === "vendor") return "/vendor";
  if (role === "student") return "/dashboard";
  return "/home";
}

const AuthBackdrop: React.FC = () => (
  <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
    <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-tr from-sky-300/40 to-indigo-300/30 blur-3xl" />
    <div className="absolute -bottom-20 -right-16 h-80 w-80 rounded-full bg-gradient-to-tr from-indigo-200/40 to-fuchsia-200/30 blur-3xl" />
    <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.12),rgba(255,255,255,0))]" />
  </div>
);

const SignIn: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useLocation() as any;
  const { login: doLogin } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);

  const validateForm = () => {
    let valid = true;
    const newErrors = { email: '', password: '' };

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      newErrors.email = 'Please enter a valid email address.';
      valid = false;
    }

    if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters.';
      valid = false;
    }

    setErrors(newErrors);
    return valid;
  };

  const handleSubmit = async () => {
    if (!validateForm() || submitting) return;
    setSubmitting(true);
    try {
      // Ensure CSRF cookie & header
      await ensureCsrfToken();
      const csrf = getCsrfToken();

      // Cookie-only login request (no Authorization header)
      const { data: res } = await api.post(
        '/auth/login',
        { email, password }, // don't force role; backend will infer
        { headers: { 'X-CSRF-Token': csrf }, withCredentials: true }
      );

      if (res?.mfa?.required && res?.mfaTempToken) {
        const base = routeForRole(res.user?.role);
        const from = state?.from && String(state.from).startsWith(base) ? state.from : base;
        navigate('/mfa', { state: { from, mfa: res.mfa, mfaTempToken: res.mfaTempToken } });
        return;
      }

      if (res?.ok && res?.user) {
        // If backend returns tokens for compatibility, keep them
        if (res.tokens) {
          doLogin({ user: res.user, tokens: res.tokens });
        } else {
          // Cookie-only session; store user shape if your store supports it
          doLogin({ user: res.user, tokens: undefined as any });
        }
        const base = routeForRole(res.user?.role);
        const from = state?.from && String(state.from).startsWith(base) ? state.from : base;
        navigate(from, { replace: true });
      } else {
        alert(res?.message || 'Sign-in failed');
      }
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Sign-in failed');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <NavBar />
            <div
        className="relative flex items-center justify-center min-h-screen px-4
                   pt-24 md:pt-28
                   bg-gradient-to-b from-slate-50 via-sky-50 to-slate-100"
      >
        {/* Decorative backdrop */}
        <AuthBackdrop />

        <div className="relative w-full max-w-md rounded-2xl border border-slate-200/60 shadow-xl bg-white/80 backdrop-blur p-6">
          <h1 className="text-2xl font-semibold text-slate-900">Welcome back</h1>
          <p className="text-sm text-slate-600 mt-1">Sign in to continue your learning journey.</p>

          <div className="mt-6 space-y-5">
            {/* Email */}
            <div>
              <label className="text-sm font-medium text-gray-700">Email</label>
              <div className="mt-1 relative group">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600">
                  {/* Mail icon */}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="opacity-80">
                    <path d="M4 6h16v12H4z" />
                    <path d="m22 6-10 7L2 6" />
                  </svg>
                </span>
                <input
                  type="email"
                  className="mt-1 block w-full px-4 py-2 rounded-xl shadow-sm focus:ring-0 focus:outline-none pl-10 bg-transparent border-none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                <div className="pointer-events-none absolute -bottom-px left-0 right-0 h-px bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 opacity-80 group-focus-within:opacity-100" />
              </div>
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="text-sm font-medium text-gray-700">Password</label>
              <div className="mt-1 relative group">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600">
                  {/* Lock icon */}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="opacity-80">
                    <rect x="4" y="11" width="16" height="9" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </svg>
                </span>
                <input
                  type="password"
                  className="mt-1 block w-full px-4 py-2 rounded-xl shadow-sm focus:ring-0 focus:outline-none pl-10 bg-transparent border-none"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <div className="pointer-events-none absolute -bottom-px left-0 right-0 h-px bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 opacity-80 group-focus-within:opacity-100" />
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
            </div>

            <div className="flex items-center justify-between text-sm">
              <button
                onClick={() => navigate('/forgot-password')}
                className="text-indigo-600 hover:text-indigo-700 underline-offset-2 hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full relative font-semibold py-2.5 rounded-xl text-white transition shadow-lg bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 disabled:opacity-60"
            >
              {submitting ? 'Signing in…' : 'Sign In'}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-2">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs text-slate-500">or</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            {/* Google Login (adds CSRF header too) */}
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={async (credentialResponse) => {
                  try {
                    await ensureCsrfToken();
                    const csrf = getCsrfToken();
                    const { data } = await api.post(
                      '/auth/google',
                      { credential: credentialResponse.credential },
                      { headers: { 'X-CSRF-Token': csrf }, withCredentials: true }
                    );

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
                onError={() => {
                  alert('Google Login Failed');
                }}
              />
            </div>

            <p className="text-center text-sm text-slate-600">
              Don’t have an account?{' '}
              <button onClick={() => navigate('/signup')} className="text-indigo-600 hover:text-indigo-700 underline-offset-2 hover:underline">
                Create one
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Footer at the end */}
      <Footer
        brandName="ECA Academy"
        tagline="Learn smarter. Build faster."
      />
    </>
  );
};

export default SignIn;
