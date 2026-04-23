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
  // PHASE 7 support: /auth/check now returns HTTP 401 when unauthenticated.
  // validateStatus accepts 4xx so axios never throws and the response
  // interceptor never fires for this endpoint — checkSession owns the retry.
  const opts = { validateStatus: (s: number) => s < 500 };

  const { data } = await api.get('auth/check', opts);
  if (data?.ok) return data;

  const refreshed = await refreshOnce().catch(() => false);
  if (!refreshed) return { ok: false };

  const again = await api.get('auth/check', opts);
  return again.data ?? { ok: false };
}

export async function refresh(): Promise<{ ok: boolean; accessToken?: string }> {
  const { data } = await api.post('auth/refresh', {});
  return data;
}

export async function logout(): Promise<{ ok: boolean }> {
  const res = await api.post(
    'auth/logout',
    {},
    {
      maxRedirects: 0,
      validateStatus: (status) => status < 400 || status === 302,
    }
  );

  return res.data ?? { ok: true };
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

// ── Settings API ──────────────────────────────────────────────

export async function changePassword(payload: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ ok: boolean; message?: string }> {
  const { data } = await api.patch('auth/me/password', payload);
  return data;
}

export async function requestEmailChange(payload: {
  currentPassword: string;
  newEmail: string;
}): Promise<{ ok: boolean; message?: string }> {
  const { data } = await api.post('auth/me/email/request', payload);
  return data;
}

export async function setupTotp(): Promise<{
  ok: boolean;
  qrDataUrl?: string;
  otpauth_url?: string;
}> {
  const { data } = await api.get('auth/me/2fa/setup');
  return data;
}

export async function enableTotp(code: string): Promise<{
  ok: boolean;
  message?: string;
  backupCodes?: string[];
}> {
  const { data } = await api.post('auth/me/2fa/enable', { code });
  return data;
}

export async function disableTotp(currentPassword: string): Promise<{
  ok: boolean;
  message?: string;
}> {
  const { data } = await api.post('auth/me/2fa/disable', { currentPassword });
  return data;
}

// ── Session management API ─────────────────────────────────────

export type Session = {
  id: string;
  device: { browser: string; os: string; userAgent: string };
  ip: string | null;
  lastUsedAt: string;
  current: boolean;
};

export async function listSessions(): Promise<{ ok: boolean; sessions: Session[] }> {
  const { data } = await api.get('auth/me/sessions');
  return data;
}

export async function revokeSession(id: string): Promise<{ ok: boolean; message?: string }> {
  const { data } = await api.delete(`auth/me/sessions/${id}`);
  return data;
}

export async function revokeOtherSessions(): Promise<{ ok: boolean; message?: string; count?: number }> {
  const { data } = await api.post('auth/me/sessions/revoke-others');
  return data;
}