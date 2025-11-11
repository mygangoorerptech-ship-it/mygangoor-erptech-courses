//`src/App.tsx`
import { Routes, Route, Navigate } from "react-router-dom";
import RequireOrgUser from "./auth/RequireOrgUser";
import { NotificationsProvider } from "./hooks/useNotifications";
import ReminderPopup from "./components/notifications/ReminderPopup";

// ---------- Public (student/user) screens ----------
// import HomeSection from "./components/home/HomeSection";
// import HomeLanding from "./components/home/HomeLanding"; // DISCONNECTED: Now using static HTML
import TracksAndCollectionsSection from "./components/pages/TracksAndCollectionsSection";
import SignIn from "./components/screens/SignIn";
import SignUp from "./components/screens/SignUp";
import AcceptInvitation from "./components/screens/AcceptInvitation";
import CourseDetail from "./components/course/CourseDetail";
import ForgotPassword from "./components/screens/ForgotPassword";
import ResetPassword from "./components/screens/ResetPassword";
import AboutSection from "./components/about/AboutSection";
import StudentDashboard from "./components/dashboard/StudentDashboard";
import Mfa from "./pages/auth/Mfa";
import ReceiptClaim from "./components/screens/ReceiptClaim";

// ---------- Admin area (already present under src/admin) ----------
import SuperadminLayout from "./admin/layouts/SuperadminLayout";
import AdminLayout from "./admin/layouts/AdminLayout";
import VendorLayout from "./admin/layouts/VendorLayout";

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

//vendor pages
import VEOverview from "./admin/pages/vendor/Overview";
import VEAssessments from "./admin/pages/vendor/Assessments";
import VEPayments from "./admin/pages/vendor/Payments";
import VECourses from "./admin/pages/vendor/Courses";
import VEReports from "./admin/pages/vendor/Reports";
import VENotes from "./admin/pages/vendor/Notes";

// ---------- Centralized guards ----------
import Shell from "./shell";

export default function App() {
  return (
    <NotificationsProvider>
    <Routes>
      {/* Default route redirects to static HTML home page */}
      <Route path="/" element={<Navigate to="/home" replace />} />
      
      {/* Home is served as static HTML - commented out React home route */}
      {/* <Route path="/home" element={<HomeLanding />} /> */}
      {/* Serve static landing inside iframe to keep URL as /home */}
      <Route path="/home" element={<StaticHome />} />
      
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
          <Shell allowedRoles={["student", /^org/i]} requireMfaIf={(r) => r === "vendor"}>
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

            {/* ---------- Org Admin area (guarded by Shell) ---------- */}
      <Route
        path="/vendor"
        element={
          <Shell allowedRoles={["vendor"]}>
            <VendorLayout />
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
        </Route>

      {/* Fallback - redirect to static HTML home */}
      <Route path="*" element={<Navigate to="/home" replace />} />
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

function StaticHome() {
  return (
    <div style={{width: "100%", height: "100vh", overflow: "hidden"}}>
      <iframe
        src="/static/home.html"
        title="Home"
        style={{border: "none", width: "100%", height: "100%"}}
      />
    </div>
  );
}
