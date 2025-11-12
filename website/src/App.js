import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Home from "./home.js";
import Login from "./login.js";
import AgentLogin from "./agentLogin.js";
import UserDashboard from "./userDashboard.js";
import Dashboard from "./dashboard.js";
import AccessControl from "./accessControl.js";

export default function App(){
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/agent-login" element={<AgentLogin />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/userdashboard" element={<UserDashboard />} />
        <Route path="/access-control" element={<AccessControl />} />
      </Routes>
    </Router>
  );
}