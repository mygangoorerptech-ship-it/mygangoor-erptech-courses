//mygf/src/components/screens/ForgotPassword.tsx
import React, { useState } from 'react';
import {api} from '../../api/client';
import NavBar from "../home/NavBar";
import Footer from "../common/Footer";

const AuthBackdrop: React.FC = () => (
  <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
    <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-tr from-sky-300/40 to-indigo-300/30 blur-3xl" />
    <div className="absolute -bottom-20 -right-16 h-80 w-80 rounded-full bg-gradient-to-tr from-indigo-200/40 to-fuchsia-200/30 blur-3xl" />
    <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.12),rgba(255,255,255,0))]" />
  </div>
);

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async () => {
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setMessage(res.data.message);
    } catch (err) {
      setMessage('Something went wrong');
    }
  };

  return (
    <>
      {/* full-bleed navbar */}
      <div className="relative z-20">
        <NavBar />
      </div>

      <div className="relative min-h-[calc(100vh-64px)] flex items-center justify-center px-4 bg-gradient-to-b from-slate-50 via-sky-50 to-slate-100">
        <AuthBackdrop />

        <div className="relative w-full max-w-md rounded-2xl border border-slate-200/60 shadow-xl bg-white/80 backdrop-blur p-6">
          <h2 className="text-2xl font-semibold text-slate-900">Forgot Password</h2>
          <p className="text-sm text-slate-600 mt-1">
            Enter your email and we’ll send you a reset link.
          </p>

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
            </div>

            <button
              onClick={handleSubmit}
              className="w-full relative font-semibold py-2.5 rounded-xl text-white transition shadow-lg bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700"
            >
              Send Reset Link
            </button>

            {message && <p className="mt-2 text-sm text-green-600">{message}</p>}
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

export default ForgotPassword;
