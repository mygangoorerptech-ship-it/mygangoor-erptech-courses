//`src/App.tsx`
import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./auth/store";
import { checkSession } from "./api/auth";
import RequireOrgUser from "./auth/RequireOrgUser";
import { NotificationsProvider } from "./hooks/useNotifications";
import ReminderPopup from "./components/notifications/ReminderPopup";

// ---------- Public (student/user) screens ----------
// import HomeSection from "./components/home/HomeSection";
// import HomeLanding from "./components/home/HomeLanding"; // DISCONNECTED: Now using static HTML
import TracksAndCollectionsSection from "./components/pages/TracksAndCollectionsSection";
import SignUp from "./components/screens/SignUp";
import AcceptInvitation from "./components/screens/AcceptInvitation";
import CourseDetail from "./components/course/CourseDetail";
import ForgotPassword from "./components/screens/ForgotPassword";
import ResetPassword from "./components/screens/ResetPassword";
import AboutSection from "./components/about/AboutSection";
import StudentDashboard from "./components/dashboard/StudentDashboard";
import Mfa from "./pages/auth/Mfa";
import ReceiptClaim from "./components/screens/ReceiptClaim";
import SignIn from "./components/screens/SignIn";

// ---------- Admin area (already present under src/admin) ----------
import SuperadminLayout from "./admin/layouts/SuperadminLayout";
import AdminLayout from "./admin/layouts/AdminLayout";
import TeacherLayout from "./admin/layouts/TeacherLayout";

// Superadmin pages
import SAOverview from "./admin/pages/superadmin/Overview";
import SAOrganizations from "./admin/pages/superadmin/Organizations";
import SAUsers from "./admin/pages/superadmin/Users";
import SAStudents from "./admin/pages/superadmin/Students";
import SACourses from "./admin/pages/superadmin/Courses";
import SAPayments from "./admin/pages/superadmin/Payments";
import SASubscriptions from "./admin/pages/superadmin/Subscriptions";
import SAAnalytics from "./admin/pages/superadmin/Analytics";
import SACMS from "./admin/pages/superadmin/CMS";
import SAAuditLogs from "./admin/pages/superadmin/AuditLogs";
import SACompliance from "./admin/pages/superadmin/Compliance";
import SAIntegrations from "./admin/pages/superadmin/Integrations";
import SAPayouts from "./admin/pages/superadmin/Payouts";
import SAPayoutDetail from "./admin/pages/superadmin/PayoutDetail";
import SAReconciliation from "./admin/pages/superadmin/Reconciliation";
import SASettings from "./admin/pages/superadmin/Settings";
import SAReports from "./admin/pages/superadmin/Reports";
import SA_Assessments from "./admin/pages/superadmin/Assessments";

// Admin pages
import ADOverview from "./admin/pages/admin/Overview";
import ADCourses from "./admin/pages/admin/Courses";
import ADCurriculum from "./admin/pages/admin/Curriculum";
import ADAssessments from "./admin/pages/admin/Assessments";
import ADAssessmentQuestions from "./admin/pages/admin/AssessmentQuestions";
import ADAssignments from "./admin/pages/admin/Assignments";
import ADAssignmentSubmissions from "./admin/pages/admin/AssignmentSubmissions";
import ADCertificates from "./admin/pages/admin/Certificates";
import ADStudents from "./admin/pages/admin/Students";
import ADPayments from "./admin/pages/admin/Payments";
import ADOrders from "./admin/pages/admin/Orders";
import ADSubscriptions from "./admin/pages/admin/Subscriptions";
import ADReviews from "./admin/pages/admin/Reviews";
import ADMedia from "./admin/pages/admin/Media";
import ADMarketing from "./admin/pages/admin/Marketing";
import ADReports from "./admin/pages/admin/Reports";
import ADCommunity from "./admin/pages/admin/Community";
import ADSettings from "./admin/pages/admin/Settings";
import ADUsers from "./admin/pages/admin/Users";
import ADNotes from "./admin/pages/admin/Notes";

//teacher pages
import VEOverview from "./admin/pages/teacher/Overview";
import VEAssessments from "./admin/pages/teacher/Assessments";
import VEPayments from "./admin/pages/teacher/Payments";
import VECourses from "./admin/pages/teacher/Courses";
import VEReports from "./admin/pages/teacher/Reports";
import VENotes from "./admin/pages/teacher/Notes";
import VEStudents from "./admin/pages/teacher/Students";

// ---------- Centralized guards ----------
import Shell from "./shell";

// PHASE 2: poll interval in ms — check session every 4 minutes.
const SESSION_POLL_MS = 4 * 60 * 1000;

export default function App() {
  // Remove the static HTML splash screen after React's first paint.
  // The CSS transition on #splash gives a smooth 350 ms fade-out.
  useEffect(() => {
    const splash = document.getElementById("splash");
    if (!splash) return;
    splash.classList.add("splash-hide");
    const timer = setTimeout(() => splash.remove(), 380);
    return () => clearTimeout(timer);
  }, []);

  // PHASE 6: cross-tab logout sync.
  // When logout() in any tab writes "auth:logout" to localStorage, the
  // storage event fires in every OTHER open tab. The handler calls logout()
  // in that tab, which clears state and navigates to /login.
  // Guard: only act when this tab still has an authenticated user — prevents
  // cascading re-calls on tabs that are already logged out.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "auth:logout") return;
      const state = useAuth.getState();
      if (!state.user) return; // already logged out in this tab
      state.logout();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // PHASE 2: background session poll — detects server-side revocation or
  // expiry without waiting for the user to make an API call.
  // Uses checkSession() directly (not hydrate()) to avoid flipping
  // status → "checking", which would flash a "Loading…" screen.
  // The response interceptor (Phase 1) handles logout if any *other*
  // API call gets a permanent 401; this poller covers the idle-user case.
  useEffect(() => {
    const id = setInterval(async () => {
      const { user, status } = useAuth.getState();
      // Only poll while authenticated and auth state is stable.
      if (!user || status !== "ready") return;
      try {
        const res = await checkSession();
        if (res && !res.ok) {
          // Both /auth/check and the silent refresh inside checkSession failed.
          useAuth.getState().logout();
        }
      } catch {
        // Interceptor (Phase 1) may have already triggered logout.
        // Any other transient error (network, timeout) is intentionally ignored.
      }
    }, SESSION_POLL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <NotificationsProvider>
    <Routes>
      {/* Default route redirects to static HTML home page */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      
      {/* Home is served as static HTML from html-pages folder (outside React) */}
      {/* The backend and vite.config.ts handle serving /home directly */}
      {/* We don't need a React route for /home anymore - it's served as plain HTML */}
      
      {/* Public: Tracks catalog is accessible without authentication */}
<Route path="/tracks" element={<TracksAndCollectionsSection />} />

<Route
  path="/course/:courseId"
  element={
    <RequireOrgUser loading={<TracksGateLoader />}>
      <CourseDetail />
    </RequireOrgUser>
  }
/>
      <Route path="/about" element={<AboutSection />} />
      <Route path="/login" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/accept-invitation" element={<AcceptInvitation />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/claim-receipt" element={<ReceiptClaim />} />

      {/* Student dashboard (protected by Shell) */}
      <Route
        path="/dashboard"
        element={
          <Shell allowedRoles={["student", /^org/i]} requireMfaIf={(r) => r === "teacher"}>
            <StudentDashboard />
          </Shell>
        }
      />

      {/* MFA route target */}
      <Route path="/mfa" element={<Mfa />} />

      {/* ---------- Superadmin area (guarded by Shell) ---------- */}
      <Route
        path="/superadmin"
        element={
          <Shell allowedRoles={["superadmin"]}>
            <SuperadminLayout />
          </Shell>
        }
      >
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<SAOverview />} />
        <Route path="organizations" element={<SAOrganizations />} />
        <Route path="users" element={<SAUsers />} />
        <Route path="students" element={<SAStudents />} />
        <Route path="courses" element={<SACourses />} />
        <Route path="payments" element={<SAPayments />} />
        <Route path="subscriptions" element={<SASubscriptions />} />
        <Route path="analytics" element={<SAAnalytics />} />
        <Route path="cms" element={<SACMS />} />
        <Route path="audit" element={<SAAuditLogs />} />
        <Route path="compliance" element={<SACompliance />} />
        <Route path="integrations" element={<SAIntegrations />} />
        <Route path="payouts" element={<SAPayouts />} />
        <Route path="payouts/:id" element={<SAPayoutDetail />} />
        <Route path="reconciliation" element={<SAReconciliation />} />
        <Route path="settings" element={<SASettings />} />
        <Route path="reports" element={<SAReports />} />
        <Route path="assessments" element={<SA_Assessments />} />
      </Route>

      {/* ---------- Org Admin area (guarded by Shell) ---------- */}
      <Route
        path="/admin"
        element={
          <Shell allowedRoles={["admin"]}>
            <AdminLayout />
          </Shell>
        }
      >
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<ADOverview />} />
        <Route path="courses" element={<ADCourses />} />
        <Route path="curriculum" element={<ADCurriculum />} />
        <Route path="assessments" element={<ADAssessments />} />
        <Route path="assessments/:id/questions" element={<ADAssessmentQuestions />} />
        <Route path="assignments" element={<ADAssignments />} />
        <Route path="assignments/:id/submissions" element={<ADAssignmentSubmissions />} />
        <Route path="certificates" element={<ADCertificates />} />
        <Route path="users" element={<ADUsers />} />
        <Route path="students" element={<ADStudents />} />
        <Route path="payments" element={<ADPayments />} />
        <Route path="orders" element={<ADOrders />} />
        <Route path="subscriptions" element={<ADSubscriptions />} />
        <Route path="reviews" element={<ADReviews />} />
        <Route path="media" element={<ADMedia />} />
        <Route path="marketing" element={<ADMarketing />} />
        <Route path="reports" element={<ADReports />} />
        <Route path="community" element={<ADCommunity />} />
        <Route path="settings" element={<ADSettings />} />
        <Route path="notes" element={<ADNotes />} />
      </Route>

            {/* ---------- Teacher area (primary — guarded by Shell) ---------- */}
      <Route
        path="/teacher"
        element={
          <Shell allowedRoles={["teacher"]}>
            <TeacherLayout />
          </Shell>
        }
      >
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<VEOverview />} />
        <Route path="courses" element={<VECourses />} />
        <Route path="reports" element={<VEReports />} />
        <Route path="assessments" element={<VEAssessments />} />
        <Route path="payments" element={<VEPayments />} />
        <Route path="notes" element={<VENotes />} />
        <Route path="students" element={<VEStudents />} />
      </Route>

      {/* Fallback - redirect to static HTML home */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
        <ReminderPopup />
    </NotificationsProvider>
  );
}

function TracksGateLoader() {
  return (
    <div className="min-h-[40vh] grid place-items-center text-slate-500">
      Loading…
    </div>
  );
}

// StaticHome component removed - HTML files are now served directly from html-pages folder
// The backend server.js and vite.config.ts handle serving /home and other HTML files
