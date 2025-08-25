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

  // primary API
  login: (payload: { user: User; tokens?: Tokens }) => void;
  verifyMfa: () => void;
  logout: () => void;

  // helpers (back-compat)
  setTokens: (t?: Tokens) => void;
  setUser: (u: User | null) => void;

  // bootstrap from cookie-backed session
  hydrate: () => Promise<void>;
};

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tokens: {},
      mfaVerified: false,
      initialized: false,
      status: "idle",

      login: ({ user, tokens }) =>
        set({
          user,
          tokens: tokens ?? {},
          mfaVerified: !user?.mfa?.required,
          status: "ready",
          initialized: true,
        }),

      verifyMfa: () => set({ mfaVerified: true }),

      logout: async () => {
        try { await apiLogout(); } catch {}
        set({ user: null, tokens: {}, mfaVerified: false, status: "ready" });
        // Optional but recommended: hard redirect to clear any in-memory state
        window.location.assign("/login");
      },

      setTokens: (t) => set({ tokens: t ?? {} }),
      setUser:   (u) => set({ user: u }),

      hydrate: async () => {
        if (get().status === "checking") return;
        set({ status: "checking" });
        try {
          const res = await checkSession(); // GET /api/auth/check (uses HttpOnly cookie)
          if (res?.ok && res.user) {
            set({
              user: res.user,
              tokens: {},
              mfaVerified: !res.user?.mfa?.required,
              initialized: true,
              status: "ready",
            });
          } else {
            set({
              user: null,
              tokens: {},
              mfaVerified: false,
              initialized: true,
              status: "ready",
            });
          }
        } catch {
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
