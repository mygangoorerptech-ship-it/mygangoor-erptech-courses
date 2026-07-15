//`src/shell.tsx`
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./auth/store";

type RolePattern = string | RegExp;

type Props = {
  children: React.ReactNode;
  allowedRoles: RolePattern[];
  requireMfaIf?: (role: string) => boolean;
};

// PHASE 3: re-validate the session if it hasn't been checked for this long.
// Keeps protected routes from rendering on stale in-memory auth state.
const REVALIDATE_MS = 5 * 60 * 1000; // 5 minutes

export default function Shell({ children, allowedRoles, requireMfaIf }: Props) {
  const location = useLocation();
  const { user, mfaVerified, status, lastChecked, hydrate } = useAuth();

  React.useEffect(() => {
    // Trigger hydration when:
    // 1. Store is idle (first mount / after logout)
    // 2. Store is ready but the session hasn't been verified in > REVALIDATE_MS
    //    (covers navigating to a protected route after a long idle period)
    // hydrate() guards internally against concurrent calls (status === "checking"),
    // so this effect is safe even if it fires multiple times.
    if (
      status === "idle" ||
      (status === "ready" && Date.now() - lastChecked > REVALIDATE_MS)
    ) {
      hydrate();
    }
  }, [status, lastChecked, hydrate]);

  // Wait until auth check finishes
  if (status !== "ready") {
    return (
      <div className="min-h-screen grid place-items-center text-black">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const role: string = user.role;
  const allowed = allowedRoles.some((pattern) =>
    typeof pattern === "string" ? role === pattern : pattern.test(role)
  );

  if (!allowed) {
  return <Navigate to="/login" replace />;
}

  if (requireMfaIf && requireMfaIf(role) && !mfaVerified) {
    return <Navigate to="/mfa" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}