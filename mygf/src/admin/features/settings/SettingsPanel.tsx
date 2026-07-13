// src/admin/features/settings/SettingsPanel.tsx
import { useState, useEffect, useCallback } from "react";
import { KeyRound, Mail, ShieldCheck, Eye, EyeOff, Copy, Check, Monitor, Smartphone, Globe, LogOut, RefreshCw } from "lucide-react";
import { useAuth } from "../../../auth/store";
import {
  changePassword,
  requestEmailChange,
  setupTotp,
  enableTotp,
  disableTotp,
  listSessions,
  revokeSession,
  revokeOtherSessions,
  type Session,
} from "../../../api/auth";

// ── Shared UI primitives ────────────────────────────────────────

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400 ${props.className ?? ""}`}
    />
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  disabled,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="pr-10"
        autoComplete="current-password"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600"
        tabIndex={-1}
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function Alert({
  type,
  message,
}: {
  type: "success" | "error";
  message: string;
}) {
  const base = "rounded-lg px-3 py-2 text-sm";
  const variants = {
    success: `${base} bg-green-50 text-green-700 border border-green-200`,
    error:   `${base} bg-red-50   text-red-700   border border-red-200`,
  };
  return <div className={variants[type]}>{message}</div>;
}

function SubmitButton({
  loading,
  children,
}: {
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
    >
      {loading ? "Saving…" : children}
    </button>
  );
}

// ── Tab: Password ───────────────────────────────────────────────

function PasswordTab() {
  const [current, setCurrent] = useState("");
  const [next, setNext]       = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<{ type: "success" | "error"; message: string } | null>(null);

  const validate = (): string | null => {
    if (!current) return "Current password is required";
    if (next.length < 8) return "New password must be at least 8 characters";
    if (next !== confirm) return "Passwords do not match";
    if (next === current) return "New password must differ from current password";
    return null;
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    const err = validate();
    if (err) { setResult({ type: "error", message: err }); return; }

    setLoading(true);
    try {
      const res = await changePassword({ currentPassword: current, newPassword: next });
      if (res.ok) {
        setResult({ type: "success", message: res.message ?? "Password updated. Other sessions have been signed out." });
        setCurrent(""); setNext(""); setConfirm("");
      } else {
        setResult({ type: "error", message: res.message ?? "Failed to change password." });
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setResult({ type: "error", message: msg ?? "Failed to change password." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <Field label="Current password">
        <PasswordInput value={current} onChange={setCurrent} placeholder="Enter current password" disabled={loading} />
      </Field>
      <Field label="New password">
        <PasswordInput value={next} onChange={setNext} placeholder="At least 8 characters" disabled={loading} id="new-password" />
      </Field>
      <Field label="Confirm new password">
        <PasswordInput value={confirm} onChange={setConfirm} placeholder="Repeat new password" disabled={loading} id="confirm-password" />
      </Field>
      {result && <Alert type={result.type} message={result.message} />}
      <SubmitButton loading={loading}>Update password</SubmitButton>
    </form>
  );
}

// ── Tab: Email ──────────────────────────────────────────────────

function EmailTab() {
  const { user } = useAuth();
  const [newEmail, setNewEmail]   = useState("");
  const [password, setPassword]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    if (!newEmail.trim()) { setResult({ type: "error", message: "New email is required" }); return; }
    if (!password)        { setResult({ type: "error", message: "Current password is required" }); return; }

    setLoading(true);
    try {
      const res = await requestEmailChange({ currentPassword: password, newEmail: newEmail.trim() });
      if (res.ok) {
        setResult({ type: "success", message: res.message ?? "Verification email sent. Check your new inbox." });
        setNewEmail(""); setPassword("");
      } else {
        setResult({ type: "error", message: res.message ?? "Failed to request email change." });
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setResult({ type: "error", message: msg ?? "Failed to request email change." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div className="rounded-lg bg-slate-50 border px-3 py-2 text-sm text-slate-800">
        Current email: <span className="font-medium text-slate-900">{user?.email ?? "—"}</span>
      </div>
      <Field label="New email address">
        <Input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="new@example.com"
          disabled={loading}
          autoComplete="email"
        />
      </Field>
      <Field label="Current password (to confirm)">
        <PasswordInput value={password} onChange={setPassword} placeholder="Enter current password" disabled={loading} />
      </Field>
      {result && <Alert type={result.type} message={result.message} />}
      <SubmitButton loading={loading}>Request email change</SubmitButton>
    </form>
  );
}

// ── Tab: Security (2FA) ─────────────────────────────────────────

function SecurityTab() {
  const { user } = useAuth();
  const isSuperadmin = user?.role === "superadmin";
  const has2fa = !!user?.mfa?.required;

  // Setup flow state
  const [qrUrl, setQrUrl]         = useState<string | null>(null);
  const [code, setCode]           = useState("");
  const [backupCodes, setBackups] = useState<string[] | null>(null);
  const [copied, setCopied]       = useState(false);

  // Disable flow state
  const [disablePassword, setDisablePassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function handleSetup() {
    setResult(null);
    setLoading(true);
    try {
      const res = await setupTotp();
      if (res.ok && res.qrDataUrl) {
        setQrUrl(res.qrDataUrl);
        setCode("");
        setBackups(null);
      } else {
        setResult({ type: "error", message: "Failed to start 2FA setup." });
      }
    } catch {
      setResult({ type: "error", message: "Failed to start 2FA setup." });
    } finally {
      setLoading(false);
    }
  }

  async function handleEnable(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    if (!/^\d{6}$/.test(code)) { setResult({ type: "error", message: "Enter a 6-digit code from your authenticator app" }); return; }

    setLoading(true);
    try {
      const res = await enableTotp(code);
      if (res.ok) {
        setBackups(res.backupCodes ?? []);
        setQrUrl(null);
        setCode("");
        setResult({ type: "success", message: res.message ?? "2FA enabled." });
        // Refresh auth state so the header reflects the new MFA status
        useAuth.getState().hydrate();
      } else {
        setResult({ type: "error", message: res.message ?? "Invalid code." });
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setResult({ type: "error", message: msg ?? "Failed to enable 2FA." });
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    if (!disablePassword) { setResult({ type: "error", message: "Password is required to disable 2FA" }); return; }

    setLoading(true);
    try {
      const res = await disableTotp(disablePassword);
      if (res.ok) {
        setDisablePassword("");
        setResult({ type: "success", message: res.message ?? "2FA disabled." });
        useAuth.getState().hydrate();
      } else {
        setResult({ type: "error", message: res.message ?? "Failed to disable 2FA." });
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setResult({ type: "error", message: msg ?? "Failed to disable 2FA." });
    } finally {
      setLoading(false);
    }
  }

  function copyBackupCodes() {
    if (!backupCodes) return;
    navigator.clipboard.writeText(backupCodes.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-6 max-w-md">
      {/* Status badge */}
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${has2fa ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
          <ShieldCheck size={12} />
          {has2fa ? "2FA enabled" : "2FA disabled"}
        </span>
        {user?.mfa?.method && (
          <span className="text-xs text-slate-500 uppercase">{user.mfa.method}</span>
        )}
      </div>

      {result && <Alert type={result.type} message={result.message} />}

      {/* ── BACKUP CODES (shown once after enabling) ── */}
      {backupCodes && backupCodes.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-amber-800">Save your backup codes</p>
          <p className="text-xs text-amber-700">
            These codes can be used to recover your account if you lose access to your authenticator app.
            Each code can only be used once. Store them somewhere safe — they won't be shown again.
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {backupCodes.map((c) => (
              <code key={c} className="rounded bg-white border border-amber-200 px-2 py-1 text-xs font-mono text-slate-800 text-center">
                {c}
              </code>
            ))}
          </div>
          <button
            type="button"
            onClick={copyBackupCodes}
            className="flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:text-amber-900"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy all codes"}
          </button>
        </div>
      )}

      {/* ── ENABLE FLOW ── */}
      {!has2fa && (
        <div className="space-y-4">
          {!qrUrl ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-800">
                Protect your account with a time-based one-time password (TOTP) from an authenticator app like Google Authenticator or Authy.
              </p>
              <button
                type="button"
                onClick={handleSetup}
                disabled={loading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? "Loading…" : "Set up 2FA"}
              </button>
            </div>
          ) : (
            <form onSubmit={handleEnable} className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-slate-700 font-medium">Scan with your authenticator app</p>
                <img src={qrUrl} alt="TOTP QR code" className="w-48 h-48 rounded-lg border" />
                <p className="text-xs text-slate-500">Then enter the 6-digit code shown in the app:</p>
              </div>
              <Field label="Verification code">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  disabled={loading}
                  autoComplete="one-time-code"
                />
              </Field>
              <div className="flex gap-2">
                <SubmitButton loading={loading}>Verify and enable</SubmitButton>
                <button
                  type="button"
                  onClick={() => { setQrUrl(null); setCode(""); setResult(null); }}
                  className="rounded-lg border px-4 py-2 text-sm text-slate-800 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ── DISABLE FLOW ── */}
      {has2fa && !isSuperadmin && (
        <form onSubmit={handleDisable} className="space-y-4">
          <p className="text-sm text-slate-800">
            Disabling 2FA will reduce the security of your account. Enter your current password to confirm.
          </p>
          <Field label="Current password">
            <PasswordInput
              value={disablePassword}
              onChange={setDisablePassword}
              placeholder="Enter current password"
              disabled={loading}
            />
          </Field>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
          >
            {loading ? "Disabling…" : "Disable 2FA"}
          </button>
        </form>
      )}

      {/* Superadmin lock notice */}
      {has2fa && isSuperadmin && (
        <div className="rounded-lg bg-slate-50 border px-3 py-2 text-sm text-slate-800">
          2FA is permanently required for superadmin accounts and cannot be disabled.
        </div>
      )}
    </div>
  );
}

// ── Tab: Active Sessions ─────────────────────────────────────────

function deviceIcon(session: Session) {
  const os = session.device.os.toLowerCase();
  if (os === "android" || os === "ios") return <Smartphone size={18} className="text-slate-500 shrink-0 mt-0.5" />;
  if (os === "windows" || os === "macos" || os === "linux") return <Monitor size={18} className="text-slate-500 shrink-0 mt-0.5" />;
  return <Globe size={18} className="text-slate-500 shrink-0 mt-0.5" />;
}

function formatRelative(dateStr: string) {
  const ms = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function SessionsTab() {
  const [sessions, setSessions]   = useState<Session[]>([]);
  const [loading, setLoading]     = useState(true);
  const [revoking, setRevoking]   = useState<string | null>(null);
  const [result, setResult]       = useState<{ type: "success" | "error"; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await listSessions();
      if (res.ok) setSessions(res.sessions);
      else setResult({ type: "error", message: "Failed to load sessions." });
    } catch {
      setResult({ type: "error", message: "Failed to load sessions." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRevoke(id: string) {
    setRevoking(id);
    setResult(null);
    try {
      const res = await revokeSession(id);
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== id));
        setResult({ type: "success", message: res.message ?? "Session revoked." });
      } else {
        setResult({ type: "error", message: res.message ?? "Failed to revoke session." });
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setResult({ type: "error", message: msg ?? "Failed to revoke session." });
    } finally {
      setRevoking(null);
    }
  }

  async function handleRevokeOthers() {
    setRevoking("others");
    setResult(null);
    try {
      const res = await revokeOtherSessions();
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.current));
        setResult({ type: "success", message: res.message ?? "Other sessions signed out." });
      } else {
        setResult({ type: "error", message: res.message ?? "Failed to sign out other sessions." });
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setResult({ type: "error", message: msg ?? "Failed to sign out other sessions." });
    } finally {
      setRevoking(null);
    }
  }

  const otherCount = sessions.filter((s) => !s.current).length;

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-800">
          {loading ? "Loading sessions…" : `${sessions.length} active session${sessions.length !== 1 ? "s" : ""}`}
        </p>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 disabled:opacity-40 transition-colors"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {result && <Alert type={result.type} message={result.message} />}

      {!loading && sessions.length === 0 && (
        <p className="text-sm text-slate-500">No active sessions found.</p>
      )}

      <ul className="space-y-2">
        {sessions.map((session) => (
          <li
            key={session.id}
            className={`flex items-start gap-3 rounded-lg border px-3 py-3 ${session.current ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"}`}
          >
            {deviceIcon(session)}
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-slate-900 truncate">
                  {session.device.browser} on {session.device.os}
                </span>
                {session.current && (
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                    This device
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                {session.ip && <span>{session.ip}</span>}
                <span>Active {formatRelative(session.lastUsedAt)}</span>
              </div>
            </div>
            {!session.current && (
              <button
                type="button"
                onClick={() => handleRevoke(session.id)}
                disabled={revoking === session.id}
                title="Sign out this session"
                className="shrink-0 flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
              >
                <LogOut size={12} />
                {revoking === session.id ? "…" : "Sign out"}
              </button>
            )}
          </li>
        ))}
      </ul>

      {otherCount > 0 && (
        <div className="pt-2 border-t">
          <button
            type="button"
            onClick={handleRevokeOthers}
            disabled={revoking === "others"}
            className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
          >
            {revoking === "others" ? "Signing out…" : `Sign out ${otherCount} other device${otherCount !== 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Tabs shell ──────────────────────────────────────────────────

type Tab = "password" | "email" | "security" | "sessions";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "password", label: "Password",       icon: <KeyRound size={16} /> },
  { id: "email",    label: "Email",           icon: <Mail size={16} /> },
  { id: "security", label: "Security (2FA)",  icon: <ShieldCheck size={16} /> },
  { id: "sessions", label: "Active Sessions", icon: <Monitor size={16} /> },
];

export default function SettingsPanel() {
  const [active, setActive] = useState<Tab>("password");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActive(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active === t.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {active === "password" && <PasswordTab />}
        {active === "email"    && <EmailTab />}
        {active === "security" && <SecurityTab />}
        {active === "sessions" && <SessionsTab />}
      </div>
    </div>
  );
}
