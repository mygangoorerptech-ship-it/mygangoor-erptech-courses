// src/api/audit.ts
import { AuditDB } from './mockAudit'
import type { AuditAction, AuditResource, AuditStatus } from '../types/audit'

// Optional: read the current user from your Zustand auth store (cookie-only session)
let getAuthState: (() => { user?: any }) | undefined;
try {
  const { useAuth } = require('../auth/store');
  if (useAuth?.getState) {
    getAuthState = useAuth.getState;
  }
} catch { /* store may not exist in some bundles (mock audit usage). */ }

// Current actor comes from in-memory store (preferred) or falls back to empty.
// No localStorage reads (cookie-only auth).
export function currentActor() {
  try {
    const user = getAuthState?.().user;
    if (user) {
      return {
        actorId: user.id ?? user._id,
        actorEmail: user.email,
        actorName: user.name,
        actorRole: user.role,
      };
    }
  } catch {}
  return {};
}

export function logAudit(params: {
  action: AuditAction
  status?: AuditStatus
  resource: AuditResource
  resourceId?: string
  orgId?: string
  message?: string
  method?: string
  path?: string
  before?: any
  after?: any
  meta?: Record<string, any>
}) {
  return AuditDB.log({
    status: params.status || 'success',
    ...currentActor(),
    ...params,
  });
}

/** For axios mutations (optional) */
export function logAxiosMutation(ok: boolean, cfg: any, respOrErr: any) {
  const method = (cfg?.method || '').toUpperCase();
  const isMut = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  if (!isMut) return;
  const status: AuditStatus = ok ? 'success' : 'failure';
  const path = cfg?.url || '';
  const msg = ok ? 'HTTP mutation' : (respOrErr?.message || 'HTTP mutation failed');
  logAudit({
    action: 'other',
    status,
    resource: 'other',
    path,
    method,
    message: msg,
    meta: {
      request: cfg?.data,
      response: ok ? respOrErr?.data : undefined,
      error: ok ? undefined : (respOrErr?.response?.data || respOrErr?.message),
    },
  });
}
