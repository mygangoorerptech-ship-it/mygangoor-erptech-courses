// src/auth/store.ts
import { create } from "zustand";
import { checkSession, logout as apiLogout } from "../api/auth";

export type Role = "superadmin" | "admin" | "vendor" | "student" | "orgadmin" | "orguser";
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

  /** Hint for public routes to decide whether to ping /auth/check in this tab. */
  hadRefreshHint: boolean;

  login: (payload: { user: User; tokens?: Tokens }) => void;
  verifyMfa: () => void;
  logout: () => void;

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
  hadRefreshHint: false,

  login: ({ user, tokens }) => {
    set(() => ({
      user,
      tokens: tokens ?? {},
      mfaVerified: !user?.mfa?.required,
      status: "ready",
      initialized: true,
      hadRefreshHint: true, // set in-memory hint for this tab
    }));
  },

  verifyMfa: () => set({ mfaVerified: true }),

  logout: async () => {
    try { await apiLogout(); } catch {}
    set({ user: null, tokens: {}, mfaVerified: false, status: "ready", hadRefreshHint: false });
    // Keep redirect behavior identical to previous code
    window.location.assign("/login.html");
  },

  setTokens: (t) => set({ tokens: t ?? {} }),
  setUser:   (u) => set({ user: u }),

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
          mfaVerified: !(res.user as any)?.mfa?.required,
          initialized: true,
          status: "ready",
          hadRefreshHint: true,
        });
      } else {
        set({
          user: null,
          tokens: {},
          mfaVerified: false,
          initialized: true,
          status: "ready",
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
        hadRefreshHint: false,
      });
    }
  },
}));
