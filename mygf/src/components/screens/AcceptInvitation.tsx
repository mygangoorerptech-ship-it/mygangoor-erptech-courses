// mygf/src/components/screens/AcceptInvitation.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import HtmlNavBar from "../common/HtmlNavBar";
import { api } from '../../api/client';
import Footer from "../common/Footer";

const AuthBackdrop: React.FC = () => (
  <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
    <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-tr from-sky-300/40 to-indigo-300/30 blur-3xl" />
    <div className="absolute -bottom-20 -right-16 h-80 w-80 rounded-full bg-gradient-to-tr from-indigo-200/40 to-fuchsia-200/30 blur-3xl" />
    <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.12),rgba(255,255,255,0))]" />
  </div>
);

const AcceptInvitation: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    password?: string;
    confirmPassword?: string;
    form?: string;
  }>({});
  const [invitation, setInvitation] = useState<{
    email: string;
    role: string;
    mfaRequired: boolean;
    mfaMethod: string | null;
    expiresAt: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Verify invitation token on mount
  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link. No token provided.');
      setLoading(false);
      return;
    }

    const verifyToken = async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/invitations/verify', {
          params: { token },
        });

        if (data?.ok && data?.invitation) {
          setInvitation(data.invitation);
          setError(null);
        } else {
          setError('Invalid or expired invitation token.');
        }
      } catch (err: any) {
        console.error('[AcceptInvitation] Verification error:', err);
        const errorData = err?.response?.data || {};
        const errorMessage = errorData?.message || 'Invalid or expired invitation token.';
        const errorCode = errorData?.error;

        if (errorCode === 'INVITATION_EXPIRED') {
          setError('This invitation has expired. Please request a new invitation from your administrator.');
        } else if (errorCode === 'INVITATION_ALREADY_USED') {
          setError('This invitation has already been used. Please contact your administrator if you need access.');
        } else if (errorCode === 'INVITATION_INVALID') {
          setError('Invalid invitation token. Please check the link and try again.');
        } else {
          setError(errorMessage);
        }
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const validateForm = () => {
    const newErrors: typeof errors = {};
    let isValid = true;

    if (!name.trim()) {
      newErrors.name = 'Please enter your name.';
      isValid = false;
    }

    if (!password) {
      newErrors.password = 'Please enter a password.';
      isValid = false;
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long.';
      isValid = false;
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password.';
      isValid = false;
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrors({});

    if (!validateForm()) {
      return;
    }

    if (!token) {
      setError('Invalid invitation token.');
      return;
    }

    try {
      setVerifying(true);
      const { data } = await api.post('/invitations/accept', {
        token,
        name: name.trim(),
        password,
      });

      if (data?.ok) {
        // Success - redirect to login page
        alert('Account created successfully! Please log in with your credentials.');
        navigate('/login', { 
          state: { 
            email: invitation?.email,
            message: 'Account created successfully! Please log in with your credentials.' 
          } 
        });
      } else {
        setError(data?.message || 'Failed to accept invitation. Please try again.');
      }
    } catch (err: any) {
      console.error('[AcceptInvitation] Accept error:', err);
      const errorData = err?.response?.data || {};
      const errorMessage = errorData?.message || 'Failed to accept invitation. Please try again.';

      if (errorData?.error === 'INVITATION_EXPIRED') {
        setError('This invitation has expired. Please request a new invitation from your administrator.');
      } else if (errorData?.error === 'INVITATION_ALREADY_USED') {
        setError('This invitation has already been used. Please contact your administrator if you need access.');
      } else if (errorData?.error === 'INVITATION_INVALID') {
        setError('Invalid invitation token. Please check the link and try again.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <>
        <HtmlNavBar />
        <div className="relative flex items-center justify-center min-h-screen px-4 pt-24 md:pt-28 bg-gradient-to-b from-slate-50 via-sky-50 to-slate-100">
          <AuthBackdrop />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200/60 shadow-xl bg-white/80 backdrop-blur p-6">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
              <p className="text-slate-600">Verifying invitation...</p>
            </div>
          </div>
        </div>
        <Footer brandName="ECA Academy" tagline="Learn smarter. Build faster." />
      </>
    );
  }

  if (error && !invitation) {
    return (
      <>
        <HtmlNavBar />
        <div className="relative flex items-center justify-center min-h-screen px-4 pt-24 md:pt-28 bg-gradient-to-b from-slate-50 via-sky-50 to-slate-100">
          <AuthBackdrop />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200/60 shadow-xl bg-white/80 backdrop-blur p-6">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h1 className="text-2xl font-semibold text-slate-900 mb-2">Invalid Invitation</h1>
              <p className="text-slate-600 mb-6">{error}</p>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-2 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
        <Footer brandName="ECA Academy" tagline="Learn smarter. Build faster." />
      </>
    );
  }

  return (
    <>
      <HtmlNavBar />
      <div className="relative flex items-center justify-center min-h-screen px-4 pt-24 md:pt-28 bg-gradient-to-b from-slate-50 via-sky-50 to-slate-100">
        <AuthBackdrop />

        <div className="relative w-full max-w-md rounded-2xl border border-slate-200/60 shadow-xl bg-white/80 backdrop-blur p-6">
          <h1 className="text-2xl font-semibold text-slate-900">Accept Invitation</h1>
          <p className="text-sm text-slate-600 mt-1">
            You've been invited to join. Set up your account by creating a password.
          </p>

          {invitation && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Email:</strong> {invitation.email}
              </p>
              <p className="text-sm text-blue-800 mt-1">
                <strong>Role:</strong> {invitation.role === 'orguser' ? 'Student' : invitation.role === 'vendor' ? 'Vendor' : invitation.role}
              </p>
              {invitation.mfaRequired && (
                <p className="text-sm text-blue-800 mt-1">
                  <strong>MFA:</strong> Required ({invitation.mfaMethod?.toUpperCase() || 'OTP'})
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors({ ...errors, name: undefined });
                }}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter your full name"
                required
                disabled={verifying}
              />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={passwordVisible ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors({ ...errors, password: undefined });
                  }}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Create a password (min. 8 characters)"
                  required
                  disabled={verifying}
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setPasswordVisible(!passwordVisible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-800"
                  disabled={verifying}
                >
                  {passwordVisible ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
              <p className="mt-1 text-xs text-slate-500">
                Password must be at least 8 characters long.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={confirmPasswordVisible ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: undefined });
                  }}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Re-enter your password"
                  required
                  disabled={verifying}
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setConfirmPasswordVisible(!confirmPasswordVisible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-800"
                  disabled={verifying}
                >
                  {confirmPasswordVisible ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>}
            </div>

            <button
              type="submit"
              disabled={verifying || !name.trim() || !password || !confirmPassword}
              className="w-full py-2.5 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              {verifying ? 'Creating Account...' : 'Create Account'}
            </button>

            <p className="text-center text-sm text-slate-600">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-indigo-600 hover:text-indigo-700 underline"
              >
                Sign in
              </button>
            </p>
          </form>
        </div>
      </div>

      <Footer brandName="ECA Academy" tagline="Learn smarter. Build faster." />
    </>
  );
};

export default AcceptInvitation;

