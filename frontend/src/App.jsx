// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import WebcamRecorder from "./components/WebcamRecorder";
import "./css/app.css";

function Nav() {
  return (
    <nav className="nav">
      <div className="nav-left">Proctoring</div>
      <div className="nav-links">
        <Link to="/dashboard" className="nav-link">
          Dashboard
        </Link>
        <Link to="/record" className="nav-link">
          Record / Test
        </Link>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          {/* direct route to your existing component */}
          <Route path="/record" element={<WebcamRecorder />} />
          <Route
            path="*"
            element={
              <div style={{ padding: 20 }}>
                Page not found. <a href="/dashboard">Go to dashboard</a>
              </div>
            }
          />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
