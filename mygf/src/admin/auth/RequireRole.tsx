// mygf/src/admin/auth/RequireRole.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './store';
import type { Role } from '../../auth/store';

function routeForRole(role?: string){
  if (role === 'superadmin' || role === 'admin') return '/admin';
  if (role && role.startsWith('org')) return '/dashboard';
  if (role === 'teacher') return '/teacher';
  if (role === 'student') return '/dashboard';
  return '/home';
}

/** Simple role hierarchy: superadmin >= admin >= orgadmin.
 * You can extend this if needed (e.g., admins can view teacher pages, etc.).
 */
function isAllowed(userRole: Role, required: Role) {
  if (userRole === required) return true;

  // superadmin can access anything below
  if (userRole === 'superadmin') return true;

  // admin can access orgadmin area
  if (userRole === 'admin' && required === 'orgadmin') return true;

  // extend here if you need teacher/orguser rules

  return false;
}

export default function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const { user } = useAuth();

  // Not logged in at all → send to unified login
  if (!user) return <Navigate to="/login" replace />;

  // Logged in but role not sufficient → send them to their own home
  if (!isAllowed(user.role as Role, role)) {
    return <Navigate to={routeForRole(user.role)} replace />;
  }

  return <>{children}</>;
}
