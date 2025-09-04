// mygf/src/auth/RequireRole.tsx
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/store";
import { useAuthHydration } from "../hooks/useAuthHydration";

type RequireRoleProps = {
  allow: string[];                 // e.g. ['orguser']
  children: ReactNode;
  loading?: ReactNode;             // optional loader while hydrating
  redirectIfRoleMismatch?: string; // default: '/dashboard'
  redirectIfUnauthed?: string;     // default: '/login'
};

export default function RequireRole({
  allow,
  children,
  loading,
  redirectIfRoleMismatch = "/dashboard",
  redirectIfUnauthed = "/login",
}: RequireRoleProps) {
  useAuthHydration(); // hydrate session for this screen
  const { user, status } = useAuth();
  const loc = useLocation();

  // Show loading UI while hydrating auth state
  if (status !== "ready") {
    return <>{loading ?? null}</>;
  }

  // Not authenticated -> go to login (preserve "next")
  if (!user) {
    return <Navigate to={redirectIfUnauthed} replace state={{ next: loc.pathname }} />;
  }

  // Role check
  const role = String((user as any)?.role || "").toLowerCase();
  const allowSet = new Set(allow.map((r) => String(r).toLowerCase()));
  if (!allowSet.has(role)) {
    return <Navigate to={redirectIfRoleMismatch} replace />;
  }

  return <>{children}</>;
}
