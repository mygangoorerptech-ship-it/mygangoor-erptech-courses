// src/components/layout/DashboardLayout.tsx
import React, { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import PageLoader from "../ui/PageLoader";
import type { Role } from "../../config/nav";

// ── Error boundary — catches render errors in any page under <Outlet /> ──────
// Uses onReset callback so "Try Again" resets the boundary WITHOUT a page reload.
class OutletErrorBoundary extends React.Component<
  { children: React.ReactNode; onReset: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; onReset: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    // intentionally empty — prevents React from printing the error
    // to the console in production builds
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onReset={this.props.onReset} />;
    }
    return this.props.children;
  }
}

// ── Fallback UI — shown when OutletErrorBoundary catches an error ─────────────
// Must be a function component so it can call useQueryClient() (a hook).
function ErrorFallback({ onReset }: { onReset: () => void }) {
  const queryClient = useQueryClient();

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-slate-500">
      <p className="text-sm">Something went wrong.</p>
      <button
        className="px-4 py-2 border rounded-lg text-sm hover:bg-slate-50 transition"
        onClick={() => {
          queryClient.invalidateQueries(); // clear stale cache so refetch is fresh
          onReset();                       // reset error boundary → re-renders Outlet
        }}
      >
        Try Again
      </button>
    </div>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────
export default function DashboardLayout({ role }: { role: Role }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [boundaryKey, setBoundaryKey] = React.useState(0);

  // Increment key to unmount/remount the error boundary (React reset pattern)
  function resetBoundary() {
    setBoundaryKey((k) => k + 1);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Topbar role={role} onMenuClick={() => setMobileOpen(true)} />

      <div className="w-full px-3 sm:px-4 lg:px-6">
        <div className="relative lg:flex lg:gap-6">
          {/* Sidebar (drawer on mobile, inline on desktop) */}
          <Sidebar role={role} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

          {/* Main content */}
          <main className="flex-1 min-w-0 pt-4 lg:pt-6 lg:pl-6">
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 p-4 sm:p-6">
              <Suspense fallback={<PageLoader />}>
                <OutletErrorBoundary key={boundaryKey} onReset={resetBoundary}>
                  <Outlet />
                </OutletErrorBoundary>
              </Suspense>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
