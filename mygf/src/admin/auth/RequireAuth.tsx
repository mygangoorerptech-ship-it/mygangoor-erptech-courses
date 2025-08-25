// mygf/src/admin/auth/RequireAuth.tsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/store';

export default function RequireAuth({children}:{children:React.ReactNode}) {
  const location = useLocation();
  const { user, status, hydrate } = useAuth();

  React.useEffect(() => {
    if (status === 'idle') hydrate();
  }, [status, hydrate]);

  if (status !== 'ready') {
    return <div className="min-h-screen grid place-items-center text-gray-500">Loading...</div>;
  }

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}
