// mygf/src/components/home/NavBar.tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import GradientIcon from "./icons/GradientIcon";
import { JoinNowModal } from "../join";
import { createPortal } from "react-dom";
import { useAuthHydration } from "../../hooks/useAuthHydration";

type IconId = "home" | "certificates" | "about" | "login";

interface NavItem {
  label: string;
  href?: string;
  iconId: IconId;
  onClick?: () => void;
}

export default function NavBar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const navigate = useNavigate();

  const { user } = useAuthHydration();
  const isAuthenticated = !!user;

  const navItems: NavItem[] = [
    { label: "Home", iconId: "home", onClick: () => navigate("/") },
    { label: "Dashboard", iconId: "certificates", onClick: () => navigate("/dashboard") },
    { label: "About", iconId: "about", onClick: () => navigate("/about") },
  ];

  // Hide "Dashboard" for guests
  const visibleNavItems = navItems.filter(
    (item) => isAuthenticated || item.label !== "Dashboard"
  );

  return (
    <header className="sticky top-0 z-50 bg-cadetBlue/90 backdrop-blur border-b border-blue-300/40">
      <nav className="flex items-center justify-between px-4 sm:px-8 py-4">
        <div className="font-bold text-xl bg-gradient-to-r from-yellow-300 via-pink-500 to-red-500 bg-clip-text text-transparent tracking-tight">
          🎓 MYGF
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6 relative">
          {visibleNavItems.map(({ label, href, iconId, onClick }) => (
            <div key={label} className="relative group">
              {onClick ? (
                <button
                  onClick={onClick}
                  className="flex items-center gap-2 px-3 py-2 border border-blue-300/40 hover:border-blue-500/60 rounded-md bg-gradient-to-r from-cyan-200 via-blue-400 to-purple-500 bg-clip-text text-transparent hover:bg-white/10 transition-all duration-300"
                >
                  <GradientIcon iconId={iconId} />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ) : (
                <a
                  href={href}
                  className="flex items-center gap-2 px-3 py-2 border border-blue-300/40 hover:border-blue-500/60 rounded-md bg-gradient-to-r from-cyan-200 via-blue-400 to-purple-500 bg-clip-text text-transparent hover:bg-white/10 transition-all duration-300"
                >
                  <GradientIcon iconId={iconId} />
                  <span className="text-sm font-medium">{label}</span>
                </a>
              )}
            </div>
          ))}

          {/* Right action: only Login for guests (no duplicate Dashboard for authed) */}
          {!isAuthenticated && (
            <Link
              to="/login"
              className="flex items-center gap-2 px-3 py-2 border border-blue-300/40 hover:border-blue-500/60 rounded-md bg-gradient-to-r from-pink-300 via-red-400 to-yellow-300 bg-clip-text text-transparent hover:bg-white/10 transition-all duration-300"
            >
              <GradientIcon iconId="login" />
              <span className="text-sm font-medium">Login</span>
            </Link>
          )}

          {/* Join Now (opens modal) */}
          <button
            type="button"
            onClick={() => setJoinOpen(true)}
            className="group flex items-center gap-2 rounded-full bg-gradient-to-br from-amber-500 via-red-500 to-pink-500 text-white px-5 py-2 font-semibold shadow-md shadow-rose-700/40 hover:scale-[1.03] active:scale-[0.98] transition-all duration-200"
          >
            <svg
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              className="group-hover:rotate-12 transition-transform text-yellow-200"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>Join Now</span>
          </button>
        </div>

        {/* Mobile Toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden rounded-md bg-white/10 text-blue-800 px-3 py-2 border border-blue-300/30 hover:bg-white/15 transition"
          aria-label="Toggle menu"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-blue-800"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-gradient-to-br from-white via-blue-50 to-blue-100 text-slate-900 px-4 py-3 space-y-2">
          {visibleNavItems.map((item) =>
            item.onClick ? (
              <button
                key={item.label}
                onClick={() => {
                  item.onClick?.();
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left flex items-center gap-2 px-4 py-2 rounded-md hover:bg-blue-200/50"
              >
                <GradientIcon iconId={item.iconId} uniqueSuffix="mobile" />
                <span>{item.label}</span>
              </button>
            ) : (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2 rounded-md hover:bg-blue-200/50"
              >
                <GradientIcon iconId={item.iconId} uniqueSuffix="mobile" />
                <span>{item.label}</span>
              </a>
            )
          )}

          {/* Only show Login for guests; no extra Dashboard for authed */}
          {!isAuthenticated && (
            <Link
              to="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-4 py-2 rounded-md hover:bg-blue-200/50"
            >
              <GradientIcon iconId="login" uniqueSuffix="mobile" />
              <span>Login</span>
            </Link>
          )}

          {/* Join Now (mobile) */}
          <button
            type="button"
            onClick={() => {
              setJoinOpen(true);
              setMobileMenuOpen(false);
            }}
            className="w-full mt-1 group flex items-center justify-center gap-2 rounded-full bg-gradient-to-br from-amber-500 via-red-500 to-pink-500 text-white px-5 py-2 font-semibold shadow-md shadow-rose-700/40 transition-all duration-200"
          >
            <span>Join Now</span>
          </button>
        </div>
      )}

      {/* Modal mount via portal */}
      {joinOpen &&
        createPortal(<JoinNowModal onClose={() => setJoinOpen(false)} />, document.body)}
    </header>
  );
}
