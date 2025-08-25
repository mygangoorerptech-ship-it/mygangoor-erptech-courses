//`src/App.tsx`
import { Routes, Route, Navigate } from "react-router-dom";

// ---------- Public (student/user) screens ----------
import HomeSection from "./components/home/HomeSection";
import TracksAndCollectionsSection from "./components/pages/TracksAndCollectionsSection";
import SignIn from "./components/screens/SignIn";
import SignUp from "./components/screens/SignUp";
import CourseDetail from "./components/course/CourseDetail";
import ForgotPassword from "./components/screens/ForgotPassword";
import ResetPassword from "./components/screens/ResetPassword";
import AboutSection from "./components/about/AboutSection";
import StudentDashboard from "./components/dashboard/StudentDashboard";
import Mfa from "./pages/auth/Mfa";

// ---------- Admin area (already present under src/admin) ----------
import SuperadminLayout from "./admin/layouts/SuperadminLayout";
import AdminLayout from "./admin/layouts/AdminLayout";

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

// ---------- Centralized guards ----------
import Shell from "./shell";

export default function App() {
  return (
    <Routes>
      {/* Default landing should be /home */}
      <Route path="/" element={<Navigate to="/home" replace />} />

      {/* Public routes */}
      <Route path="/home" element={<HomeSection />} />
      <Route path="/tracks" element={<TracksAndCollectionsSection />} />
      <Route path="/course/:courseId" element={<CourseDetail />} />
      <Route path="/about" element={<AboutSection />} />
      <Route path="/login" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />

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
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}