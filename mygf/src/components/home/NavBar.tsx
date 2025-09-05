// mygf/src/components/home/NavBar.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { useAuth } from "../../auth/store";
import { JoinNowModal } from "../join";
import NotificationBell from "../notifications/NotificationBell";

export default function NavBar() {
  const navigate = useNavigate();
const user = useAuth(s => s.user);
const role = useAuth(s => s.user?.role);
const isAuthenticated = useAuth(s => !!s.user);
const isAuthed = isAuthenticated;


  const [joinOpen, setJoinOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // expose global opener (unchanged)
  useEffect(() => {
    const handler = () => setJoinOpen(true);
    (window as any).app = (window as any).app || {};
    (window as any).app.openJoinForm = handler;
    return () => {
      if ((window as any).app?.openJoinForm === handler) delete (window as any).app.openJoinForm;
    };
  }, []);

  // close on ESC + lock body scroll while open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    if (mobileOpen) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const goLoginOrDashboard = () => {
    if (isAuthed) {
      if (role && /^org/i.test(String(role))) {
        navigate("/dashboard");
        return;
      }
      switch (role) {
        case "superadmin": navigate("/superadmin"); break;
        case "admin":      navigate("/admin"); break;
        case "vendor":     navigate("/vendor"); break;
        case "student":    navigate("/dashboard"); break;
        default:           navigate("/dashboard");
      }
    } else {
      navigate("/login");
    }
  };

  const openJoinForm = () => {
    if (!isAuthed) {
      navigate("/login");
      return;
    }
    setJoinOpen(true);
  };

  // shared handlers for links (close drawer first on mobile)
  const goHome = (e?: React.MouseEvent) => { e?.preventDefault?.(); setMobileOpen(false); navigate("/home"); };
  const goAbout = (e?: React.MouseEvent) => { e?.preventDefault?.(); setMobileOpen(false); navigate("/about"); };
  const goDashOrLogin = () => { setMobileOpen(false); goLoginOrDashboard(); };
  const openJoin = () => { setMobileOpen(false); openJoinForm(); };

  return (
    <nav className="fixed w-full z-50 bg-white/80 backdrop-blur-md border-b border-pink-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Brand */}
          <div className="flex items-center">
            <div className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-blue-500 bg-clip-text text-transparent">
              ECA Academy
            </div>
          </div>

          {/* Desktop links */}
          <div className="hidden md:flex items-center space-x-8">
            <a
              href="/home"
              onClick={goHome}
              className="nav-link text-gray-700 hover:text-pink-500 flex items-center gap-2"
            >
              <i className="fa-solid fa-house-chimney" /><span>Home</span>
            </a>
            <a
              href="/about"
              onClick={goAbout}
              className="nav-link text-gray-700 hover:text-pink-500 flex items-center gap-2"
            >
              <i className="fa-solid fa-circle-info" /><span>About</span>
            </a>

            {/* Notification bell sits inline with the desktop links */}
            <NotificationBell />
          </div>

          {/* CTAs */}
          <div className="flex items-center gap-3">
            {/* hide these on mobile; they exist in the drawer */}
            <button
              onClick={goLoginOrDashboard}
              className="hidden md:inline-flex text-gray-700 hover:text-pink-500 transition-colors items-center gap-2"
            >
              <i className="fa-solid fa-right-to-bracket" />
              {isAuthed ? "Dashboard" : "Login"}
            </button>
            <button
              type="button"
              onClick={openJoinForm}
              className="hidden md:inline-flex group items-center gap-2 rounded-full bg-gradient-to-br from-amber-500 via-red-500 to-pink-500 text-white px-5 py-2 font-semibold shadow-md shadow-rose-700/40 hover:scale-[1.03] active:scale-[0.98] transition-all duration-200"
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="group-hover:rotate-12 transition-transform text-yellow-200">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>Join Form</span>
            </button>

            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="md:hidden ml-1 inline-flex items-center justify-center rounded-xl border border-pink-100 bg-white/70 px-3 py-2 shadow-sm hover:bg-white transition"
              aria-label="Open menu"
            >
              <i className="fa-solid fa-bars text-gray-700" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile drawer + backdrop */}
      <div
        onClick={() => setMobileOpen(false)}
        className={`fixed inset-0 z-[60] bg-black/30 transition-opacity duration-300 ${mobileOpen ? "opacity-100 visible" : "opacity-0 invisible"}`}
        aria-hidden={!mobileOpen}
      />
      <aside
        role="dialog"
        aria-modal="true"
        className={`fixed top-0 right-0 z-[61] h-screen w-80 max-w-[85%] bg-white border-l border-pink-100 shadow-2xl transform transition-transform duration-300 ease-in-out
        ${mobileOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-pink-100">
          <div className="text-lg font-semibold bg-gradient-to-r from-pink-500 to-blue-500 bg-clip-text text-transparent">
            Menu
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="inline-flex items-center justify-center rounded-lg border border-pink-100 bg-white/70 p-2 hover:bg-white transition"
          >
            <i className="fa-solid fa-xmark text-gray-700" />
          </button>
        </div>

        <nav className="px-4 py-3">
          <button
            onClick={goHome}
            className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left text-gray-800 hover:bg-pink-50"
          >
            <i className="fa-solid fa-house-chimney text-pink-500" />
            <span>Home</span>
          </button>
          <button
            onClick={goAbout}
            className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left text-gray-800 hover:bg-pink-50"
          >
            <i className="fa-solid fa-circle-info text-blue-500" />
            <span>About</span>
          </button>

          <div className="my-3 h-px bg-pink-100" />

          <button
            onClick={goDashOrLogin}
            className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left text-gray-800 hover:bg-pink-50"
          >
            <i className="fa-solid fa-right-to-bracket text-gray-600" />
            <span>{isAuthed ? "Dashboard" : "Login"}</span>
          </button>

          <button
            onClick={openJoin}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-blue-500 text-white px-4 py-3 font-semibold shadow hover:shadow-lg transition"
          >
            <i className="fa-solid fa-user-plus" />
            <span>Join Form</span>
          </button>

          {/* Keep bell in the mobile drawer */}
          {/* Mobile bell: aligned with the drawer content */}
<div className="mt-4">
  <div className="w-full flex items-center gap-3 rounded-xl px-8 py-3 text-gray-800 hover:bg-pink-50">
    <NotificationBell />
    <span className="text-sm">Notifications</span>
  </div>
</div>

        </nav>

        <div className="mt-auto px-4 py-4 text-xs text-gray-500">
          © {new Date().getFullYear()} ECA Academy
        </div>
      </aside>

      {/* Modal mount via portal (unchanged) */}
      {joinOpen && createPortal(<JoinNowModal onClose={() => setJoinOpen(false)} />, document.body)}
    </nav>
  );
}
