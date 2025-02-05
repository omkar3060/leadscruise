import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import SignIn from "./components/SignIn";
import SignUp from "./components/SignUp";
import CheckNumber from "./components/CheckNumber";
import TaskExecutor from "./components/TaskExecutor";
import Dashboard from "./components/Dashboard";
import SettingsForm from "./components/SettingsForm";
import Profile from "./components/Profile";
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
        </Routes>
      </div>
    </Router>
  );
}

export default App;
