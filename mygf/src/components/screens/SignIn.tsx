// mygf/src/components/screens/SignIn.tsx
import React, { useEffect, useState } from 'react';
import NavBar from "../home/NavBar";
import { useNavigate, useLocation } from 'react-router-dom';
import Footer from "../common/Footer";
import { useAuth } from '../../auth/store';
import { api } from '../../api/client';
// import { ensureCsrfToken, getCsrfToken } from '../../config/csrf';
// import { GoogleLogin } from '@react-oauth/google';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

function routeForRole(role?: string) {
  if (role === "superadmin") return "/superadmin";
  if (role === "admin") return "/admin";
  if (role && role.startsWith("org")) return "/dashboard";
  if (role === "teacher") return "/teacher";
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
  const [formError, setFormError] = useState('');

  const validateForm = () => {
    let valid = true;

    const next = {
      email: '',
      password: '',
    };

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!normalizedEmail) {
      next.email = 'Email address is required.';
      valid = false;
    } else if (normalizedEmail.length > 254) {
      next.email = 'Email address is too long.';
      valid = false;
    } else if (!emailPattern.test(normalizedEmail)) {
      next.email = 'Please enter a valid email address.';
      valid = false;
    }

    if (!normalizedPassword) {
      next.password = 'Password is required.';
      valid = false;
    } else if (normalizedPassword.length > 128) {
      next.password = 'Password is too long.';
      valid = false;
    }

    setErrors(next);
    if (formError) {
      setFormError('');
    }
    return valid;
  };

  const handleSubmit = async () => {
    if (submitting) return;

    setFormError('');

    if (!validateForm()) return;
    setSubmitting(true);
    try {
      // The backend currently exempts /auth/login from CSRF validation.
      // Fetching a token here therefore changes no server-side security decision
      // and only adds a serial GET /csrf round trip before credential verification.
      const normalizedEmail = email.trim().toLowerCase();

      const { data: res } = await api.post('/auth/login', {
        email: normalizedEmail,
        password,
      });

      if (res?.mfa?.required && res?.mfaTempToken) {
        const base = routeForRole(res.user?.role);
        const from = state?.from && String(state.from).startsWith(base) ? state.from : base;
        toast(
          'Multi-factor authentication required',
          {
            icon: '🔐',
          }
        );
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
        toast.success(
          'Signed in successfully'
        );
        navigate(from, { replace: true });
      } else {
        setFormError(res?.message || 'Unable to sign in. Please try again.');
      }
    } catch (error: any) {
      console.error(error);

      const status =
        error?.response?.status;

      const message =
        error?.response?.data?.message;

      let finalMessage =
        'Unable to sign in right now. Please try again later.';

      if (status === 401) {
        finalMessage =
          'Incorrect email or password.';
      } else if (status === 403) {
        finalMessage =
          message ||
          'Your account access is restricted.';
      } else if (status === 429) {
        finalMessage =
          'Too many attempts. Please wait and try again.';
      } else if (message) {
        finalMessage = message;
      }

      setFormError(finalMessage);

      toast.error(finalMessage);
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
          <p className="text-sm text-slate-800 mt-1">Sign in to continue your learning journey.</p>

          {formError && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div className="mt-6 space-y-5">
            {/* Email */}
            <div>
              <label className="text-sm font-medium text-black">Email</label>
              <div className="mt-1 relative group">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-800">
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
                  onChange={(e) => {
                    setEmail(e.target.value);

                    if (formError) {
                      setFormError('');
                    }
                  }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  maxLength={254}
                />
                <div className="pointer-events-none absolute -bottom-px left-0 right-0 h-px bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 opacity-80 group-focus-within:opacity-100" />
              </div>
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="text-sm font-medium text-black">Password</label>
              <div className="mt-1 relative group">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-800">
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
                  onChange={(e) => {
                    setPassword(e.target.value);

                    if (formError) {
                      setFormError('');
                    }
                  }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  maxLength={128}
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
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full relative font-semibold py-2.5 rounded-xl text-white transition shadow-lg bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {
                submitting
                  ? (
                    <span className="inline-flex items-center gap-2 justify-center">
                      <Loader2
                        className="animate-spin"
                        size={18}
                      />

                      Signing in...
                    </span>
                  )
                  : 'Sign In'
              }
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-2">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs text-slate-500">....</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            {/* Google Login (adds CSRF header too) */}
            {/* <div className="flex justify-center">
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
                    toast.error(
  err?.response?.data?.message ||
  'Google login failed'
);
                  }
                }}
                onError={() => {
                  toast.error(
  'Google Login Failed'
);
                }}
              />
            </div> */}

            <p className="text-center text-sm text-slate-800">
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
      />
    </>
  );
};

export default SignIn;
