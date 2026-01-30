// src/api/auth.ts
// ✅ use the unified axios client
import { api } from './client';
import type { Role } from '../auth/store';
import { refreshOnce } from './refreshGate';

export type MfaMethod = 'otp' | 'totp';

export type LoginResponse = {
  ok: boolean;
  user?: unknown;
  tokens?: { accessToken: string; refreshToken: string };
  mfa?: { required: boolean; method?: MfaMethod };
  mfaTempToken?: string;   // present when MFA is required instead of tokens
  message?: string;
};

export async function login(email: string, password: string, as?: Role): Promise<LoginResponse> {
  const { data } = await api.post('auth/login', { email, password, as });
  return data;
}

export async function verifyMfa(params: { code: string; method: MfaMethod; mfaTempToken: string }): Promise<LoginResponse> {
  const { data } = await api.post('auth/mfa/verify', params);
  return data;
}

export async function resendEmailOtp(mfaTempToken: string): Promise<{ ok: boolean }> {
  const { data } = await api.post('auth/mfa/send', { mfaTempToken });
  return data;
}

export async function totpSetup(mfaTempToken: string): Promise<{ ok: boolean; qrDataUrl?: string; otpauth_url?: string }> {
  const { data } = await api.post('auth/totp/setup', { mfaTempToken });
  return data;
}

export async function totpVerify(params: { code: string; mfaTempToken: string }): Promise<LoginResponse> {
  const { data } = await api.post('auth/totp/verify', params);
  return data;
}

export async function checkSession(): Promise<{ ok: boolean; user?: unknown }> {
  // Note: backend /auth/check never performs refresh by design.
  // We implement enterprise-grade stability by attempting ONE silent refresh
  // when check says unauthenticated, then retrying check once.
  const { data } = await api.get('auth/check'); // withCredentials already true
  if (data?.ok) return data;

  const refreshed = await refreshOnce().catch(() => false);
  if (!refreshed) return data;

  const again = await api.get('auth/check');
  return again.data;
}

export async function refresh(): Promise<{ ok: boolean; accessToken?: string }> {
  const { data } = await api.post('auth/refresh');
  return data;
}

export async function logout(): Promise<{ ok: boolean }> {
  const { data } = await api.post('auth/logout');
  return data;
}

//SignUp precheck logics
export type PrecheckResponse = {
  mode: 'signin' | 'signup';
  reason?: string;
  mfa?: { required: boolean; method: 'otp'|'totp'|null };
};

export function precheckEmail(email: string) {
  return api.get('auth/precheck', { params: { email } })
    .then(r => r.data as PrecheckResponse);
}

export function signupStudent(payload: { name: string; email: string; password: string }) {
  return api.post('auth/signup-student', payload).then(r => r.data as { ok: true });
}