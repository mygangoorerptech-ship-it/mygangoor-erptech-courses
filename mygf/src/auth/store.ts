// src/auth/store.ts
import { create } from "zustand";
import { checkSession, logout as apiLogout } from "../api/auth";

export type Role = "superadmin" | "admin" | "teacher" | "student" | "orgadmin" | "orguser";
export type MfaInfo = { required: boolean; method?: "otp" | "totp" };

export type User = {
  id: string;
  name?: string;
  email?: string;
  role: Role;
  orgId?: string | null;
  mfa?: MfaInfo;
};

export type Tokens = {
  accessToken?: string | null;
  refreshToken?: string | null;
};

type Status = "idle" | "checking" | "ready";

type AuthState = {
  user: User | null;
  tokens: Tokens;
  mfaVerified: boolean;
  initialized: boolean;
  status: Status;
  /** Epoch ms of the last successful /auth/check. 0 = never checked. */
  lastChecked: number;

  /** Hint for public routes to decide whether to ping /auth/check in this tab. */
  hadRefreshHint: boolean;

  login: (payload: { user: User; tokens?: Tokens }) => void;
  verifyMfa: () => void;
  logout: () => Promise<void>;

  setTokens: (t?: Tokens) => void;
  setUser: (u: User | null) => void;

  hydrate: () => Promise<void>;
};

export const selectAuthLite = (s: AuthState) => ({
  user: s.user,
  role: s.user?.role,
  isAuthenticated: !!s.user,
});

export const useAuth = create<AuthState>()((set, get) => ({
  user: null,
  tokens: {},
  mfaVerified: false,
  initialized: false,
  status: "idle",
  lastChecked: 0,
  hadRefreshHint: false,

  login: ({ user, tokens }) => {
    set(() => ({
      user,
      tokens: tokens ?? {},
      mfaVerified: !user?.mfa?.required,
      status: "ready",
      initialized: true,
      lastChecked: Date.now(),
      hadRefreshHint: true,
    }));
  },

  verifyMfa: () => set({ mfaVerified: true }),

  logout: async () => {
    // Seal the refresh gate before the API call so a page reload cannot
    // silently restore the session via the refresh path even if the call fails.
    try { localStorage.setItem("eca:auth:terminated", JSON.stringify({ ts: Date.now() })); } catch { /* storage unavailable in private browsing */ }

    let apiError: unknown = null;
    try {
      await apiLogout();
    } catch (err) {
      apiError = err;
    }

    // Always clear local state and signal other tabs regardless of API outcome.
    set({ user: null, tokens: {}, mfaVerified: false, status: "idle", lastChecked: 0, hadRefreshHint: false });
    try { localStorage.setItem("auth:logout", Date.now().toString()); } catch { /* storage unavailable in private browsing */ }
    sessionStorage.removeItem("pendingJoinModal");
    sessionStorage.removeItem("pendingJoinCourseId");
    sessionStorage.removeItem("autoOpenJoinModal");

    // Re-throw after cleanup so user-facing callers can surface the failure
    // explicitly instead of silently claiming the session was terminated.
    if (apiError) throw apiError;
  },

  setTokens: (t) => set({ tokens: t ?? {} }),
  setUser: (u) => set({ user: u }),

  hydrate: async () => {
    const { status } = get();
    if (status === "checking") return;

    set({ status: "checking" });
    try {
      const res = await checkSession();
      if (res?.ok && res?.user) {
        set({
          user: res.user as User,
          tokens: {},
          mfaVerified: !(res.user as User)?.mfa?.required,
          initialized: true,
          status: "ready",
          lastChecked: Date.now(),
          hadRefreshHint: true,
        });
      } else {
        set({
          user: null,
          tokens: {},
          mfaVerified: false,
          initialized: true,
          status: "ready",
          lastChecked: Date.now(),
          hadRefreshHint: false,
        });
      }
    } catch {
      set({
        user: null,
        tokens: {},
        mfaVerified: false,
        initialized: true,
        status: "ready",
        lastChecked: Date.now(),
        hadRefreshHint: false,
      });
    }
  },
}));
