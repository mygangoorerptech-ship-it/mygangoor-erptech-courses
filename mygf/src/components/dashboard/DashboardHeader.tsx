//mygf/src/components/dashboard/DashboardHeader.tsx
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/store";

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
        await storeLogout?.();
      } catch {
        alert("Sign out failed. Please try again or close this browser tab to end your session.");
        return;
      }
      navigate("/login", { replace: true });
    }
  }, [onSignOut, storeLogout, navigate]);

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-4">

          {/* LEFT */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100">
              <i className="fas fa-graduation-cap text-gray-600 text-sm" />
            </div>
            <h1 className="text-lg font-semibold text-gray-900">
              Student Dashboard
            </h1>
          </div>

          {/* RIGHT */}
          <button
            onClick={handleClick}
            className="border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium px-3 py-1.5 rounded-lg transition flex items-center gap-2"
          >
            <i className="fas fa-sign-out-alt text-xs" />
            <span>Sign Out</span>
          </button>

        </div>
      </div>
    </header>
  );
}
