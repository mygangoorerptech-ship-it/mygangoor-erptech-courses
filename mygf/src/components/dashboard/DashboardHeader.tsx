//mygf/src/components/dashboard/DashboardHeader.tsx
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { logout as apiLogout } from "../../api/auth";
import { useAuth } from "../../auth/store";
import { resetAuthHydration } from "../../hooks/useAuthHydration";

type Props = {
  onSignOut?: () => void;
};

export default function DashboardHeader({ onSignOut }: Props) {
  const navigate = useNavigate();
  const { logout: storeLogout } = useAuth();

  const handleClick = useCallback(async () => {
    if (onSignOut) return onSignOut();

    if (confirm("Are you sure you want to sign out?")) {
      try {
        await apiLogout(); // clear cookies server-side
      } catch {
        // ignore network errors; we'll still clear client state
      } finally {
        storeLogout?.();      // clear Zustand
        resetAuthHydration(); // allow fresh re-hydration next visit
        navigate("/login", { replace: true });
      }
    }
  }, [onSignOut, storeLogout, navigate]);

  return (
    <header className="bg-white shadow-lg border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-4">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-lg">
              <i className="fas fa-graduation-cap text-white text-xl" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Student Dashboard</h1>
          </div>

          <button
            onClick={handleClick}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <i className="fas fa-sign-out-alt" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
