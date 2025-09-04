// src/auth/store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
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

type Tokens = {
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

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tokens: {},
      mfaVerified: false,
      initialized: false,
      status: "idle",

      login: ({ user, tokens }) =>
        set(() => {
          // Mark that we have a refresh cookie/session
          localStorage.setItem("auth:hasRefresh", "1");
          return {
            user,
            tokens: tokens ?? {},
            mfaVerified: !user?.mfa?.required,
            status: "ready",
            initialized: true,
          };
        }),

      verifyMfa: () => set({ mfaVerified: true }),

      logout: async () => {
        try { await apiLogout(); } catch {}
        // clear local hint so public pages won't try to hydrate
        localStorage.removeItem("auth:hasRefresh");
        set({ user: null, tokens: {}, mfaVerified: false, status: "ready" });
        window.location.assign("/login");
      },

      setTokens: (t) => set({ tokens: t ?? {} }),
      setUser:   (u) => set({ user: u }),

      hydrate: async () => {
        if (get().status === "checking") return;
        set({ status: "checking" });
        try {
          const res = await checkSession();
          if (res?.ok && res.user) {
            localStorage.setItem("auth:hasRefresh", "1");
            set({
              user: res.user,
              tokens: {},
              mfaVerified: !res.user?.mfa?.required,
              initialized: true,
              status: "ready",
            });
          } else {
            localStorage.removeItem("auth:hasRefresh");
            set({
              user: null,
              tokens: {},
              mfaVerified: false,
              initialized: true,
              status: "ready",
            });
          }
        } catch {
          localStorage.removeItem("auth:hasRefresh");
          set({
            user: null,
            tokens: {},
            mfaVerified: false,
            initialized: true,
            status: "ready",
          });
        }
      },
    }),
    {
      name: "auth",
      onRehydrateStorage: () => (_state, _err) => {
        Promise.resolve().then(() => {
          (useAuth as any).setState?.({ initialized: true });
        });
      },
    }
  )
);
