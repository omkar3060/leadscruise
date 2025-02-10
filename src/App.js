import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import SignIn from "./components/SignIn";
import SignUp from "./components/SignUp";
import CheckNumber from "./components/CheckNumber";
import TaskExecutor from "./components/TaskExecutor";
import Dashboard from "./components/Dashboard";
import SettingsForm from "./components/SettingsForm";
import Profile from "./components/Profile";
import Footer from "./components/Footer"; // Import Footer
import Master from "./components/Master";
import Plans from "./components/Plans";
function App() {
  return (
    <Router>
      <div className="container">
        <Routes>
          <Route path="/" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/check-number" element={<CheckNumber />} />
          <Route path="/execute-task" element={<TaskExecutor />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<SettingsForm />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/master" element={<Master />} />
          <Route path="/plans" element={<Plans />} />
        </Routes>
        <Footer /> {/* Footer will be displayed on all pages */}
      </div>
    </Router>
  );
}

export default App;
