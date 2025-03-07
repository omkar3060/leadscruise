import React from "react";
import { BrowserRouter as Router, Route, Routes, useLocation } from "react-router-dom";
import SignIn from "./components/SignIn";
import SignUp from "./components/SignUp";
import CheckNumber from "./components/CheckNumber";
import TaskExecutor from "./components/TaskExecutor";
import Dashboard from "./components/Dashboard";
import SettingsForm from "./components/SettingsForm";
import Profile from "./components/Profile";
import Footer from "./components/Footer";
import Master from "./components/Master";
import Plans from "./components/Plans";
import EnterEmail from "./components/EnterEmail";
import ResetPassword from "./components/ResetPassword";
import ProtectedRoute from "./components/ProtectedRoute";
import ComingSoonFeature from "./components/ComingSoon";
import NotFound from "./components/NotFound";
import LandingPage from "./components/LandingPage";
import UsersList from "./components/UserList";

const Layout = () => {
  const location = useLocation();
  const isLandingPage = location.pathname === "/";

  return (
    <div className="container">
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/enter-email" element={<EnterEmail />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected Routes */}
        <Route
          path="/check-number"
          element={
            <ProtectedRoute>
              <CheckNumber />
            </ProtectedRoute>
          }
        />
        <Route
          path="/execute-task"
          element={
            <ProtectedRoute>
              <TaskExecutor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        {/* ✅ FIXED: Nested Routes for Master */}
        <Route
          path="/master/*"
          element={
            <ProtectedRoute adminOnly={true}>
              <Master />
            </ProtectedRoute>
          }
        />
        <Route
          path="/master/users"
          element={
            <ProtectedRoute adminOnly={true}>
              <UsersList />
            </ProtectedRoute>
          }
        />

        <Route
          path="/plans"
          element={
            <ProtectedRoute>
              <Plans />
            </ProtectedRoute>
          }
        />
        <Route path="/whatsapp" element={<ProtectedRoute><ComingSoonFeature /></ProtectedRoute>} />
        <Route path="/sheets" element={<ProtectedRoute><ComingSoonFeature /></ProtectedRoute>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
      {!isLandingPage && <Footer />}
    </div>
  );
};

function App() {
  return (
    <Router>
      <Layout />
    </Router>
  );
}

export default App;
