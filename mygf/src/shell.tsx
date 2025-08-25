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

export default function Shell({ children, allowedRoles, requireMfaIf }: Props) {
  const location = useLocation();
  const { user, mfaVerified, status, hydrate } = useAuth();

  React.useEffect(() => {
    if (status === "idle") hydrate();
  }, [status, hydrate]);

  // Wait until auth check finishes
  if (status !== "ready") {
    return (
      <div className="min-h-screen grid place-items-center text-gray-500">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const role: string = (user as any).role;
  const allowed = allowedRoles.some((pattern) =>
    typeof pattern === "string" ? role === pattern : pattern.test(role)
  );

  if (!allowed) {
    return <Navigate to="/home" replace />;
  }

  if (requireMfaIf && requireMfaIf(role) && !mfaVerified) {
    return <Navigate to="/mfa" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}