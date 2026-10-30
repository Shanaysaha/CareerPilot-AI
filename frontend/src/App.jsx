import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import { AppShell } from "./components.jsx";
import { ContactPage, FeaturesPage, LandingPage, LoginPage, RegisterPage, ResetPasswordPage } from "./pages/PublicPages.jsx";
import { StaffDashboardPage } from "./pages/StaffPages.jsx";
import { AptitudePage, CareerPage, CodingPage, DashboardPage, InterviewPage, LearningPage, NotificationsPage, ProfilePage, ReadinessPage, ResumePage, SettingsPage, SkillGapPage } from "./pages/StudentPages.jsx";

// Keep private pages behind sign-in and remember where the visitor was going.
function ProtectedArea() {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();
  if (loading) return <div className="loading-screen"><span className="spinner"/><p>Getting CareerPilot ready…</p></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }}/>;
  return <AppShell user={user} signOut={signOut}><Outlet/></AppShell>;
}

// Send each signed-in role to the workspace designed for that role.
function WorkspaceHome() {
  const { user } = useAuth();
  return <Navigate to={user?.role === "student" ? "/app/dashboard" : "/app/staff"} replace/>;
}

// Show student-only routes to students and staff pages to placement staff.
function StudentOnly({ children }) {
  const { user } = useAuth();
  return user?.role === "student" ? children : <Navigate to="/app/staff" replace/>;
}

// Keep the placement workspace away from student accounts.
function StaffOnly({ children }) {
  const { user } = useAuth();
  return user?.role === "student" ? <Navigate to="/app/dashboard" replace/> : children;
}

// Connect every public, student, and placement page to its friendly web address.
export default function App() {
  return <Routes>
    <Route path="/" element={<LandingPage/>}/>
    <Route path="/features" element={<FeaturesPage/>}/>
    <Route path="/contact" element={<ContactPage/>}/>
    <Route path="/login" element={<LoginPage/>}/>
    <Route path="/register" element={<RegisterPage/>}/>
    <Route path="/reset-password" element={<ResetPasswordPage/>}/>
    <Route path="/app" element={<ProtectedArea/>}>
      <Route index element={<WorkspaceHome/>}/>
      <Route path="staff" element={<StaffOnly><StaffDashboardPage/></StaffOnly>}/>
      <Route path="dashboard" element={<StudentOnly><DashboardPage/></StudentOnly>}/>
      <Route path="resume" element={<StudentOnly><ResumePage/></StudentOnly>}/>
      <Route path="skills" element={<StudentOnly><SkillGapPage/></StudentOnly>}/>
      <Route path="learning" element={<StudentOnly><LearningPage/></StudentOnly>}/>
      <Route path="interview" element={<StudentOnly><InterviewPage/></StudentOnly>}/>
      <Route path="coding" element={<StudentOnly><CodingPage/></StudentOnly>}/>
      <Route path="aptitude" element={<StudentOnly><AptitudePage/></StudentOnly>}/>
      <Route path="career" element={<StudentOnly><CareerPage/></StudentOnly>}/>
      <Route path="notifications" element={<StudentOnly><NotificationsPage/></StudentOnly>}/>
      <Route path="profile" element={<StudentOnly><ProfilePage/></StudentOnly>}/>
      <Route path="readiness" element={<StudentOnly><ReadinessPage/></StudentOnly>}/>
      <Route path="settings" element={<StudentOnly><SettingsPage/></StudentOnly>}/>
    </Route>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>;
}
