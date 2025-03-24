import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Route, Routes, useLocation, Navigate } from "react-router-dom";
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
import Sheets from "./components/Sheets";
import TodaySubscriptions from "./components/SubscriptionsToday";
import SubscriptionsThisWeek from "./components/SubscriptionsThisWeek";

const Layout = () => {
  const location = useLocation();
  const [isAppDomain, setIsAppDomain] = useState(false);

  useEffect(() => {
    // Check if the app is running on app.leadscruise.com
    setIsAppDomain(window.location.hostname === "app.leadscruise.com");
  }, []);

  return (
    <div className="container">
      <Routes>
        {/* Redirect "/" to "/login" if on app.leadscruise.com */}
        {isAppDomain ? (
          <Route path="/" element={<SignIn />} />
        ) : (
          <Route path="/" element={<LandingPage />} />
        )}

        {/* Public Routes */}
        {/* <Route path="/login" element={<SignIn />} /> */}
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

        {/* Admin Routes */}
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
          path="/master/subscriptions-today"
          element={
            <ProtectedRoute adminOnly={true}>
              <TodaySubscriptions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/master/subscriptions-week"
          element={
            <ProtectedRoute adminOnly={true}>
              <SubscriptionsThisWeek />
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
        <Route path="/sheets" element={<ProtectedRoute><Sheets /></ProtectedRoute>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
      
      {/* Show Footer except on Landing Page */}
      {isAppDomain && <Footer />}
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
