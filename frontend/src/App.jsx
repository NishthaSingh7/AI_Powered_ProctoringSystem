// src/App.jsx
import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
  useLocation,
} from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import WebcamRecorder from "./components/WebcamRecorder";
import "./css/app.css";

function Nav() {
  const { pathname } = useLocation();

  return (
    <nav className="nav">
      <div className="nav-left">AI <span>Powered Proctoring System</span></div>
      

      <div className="nav-links">
        <Link
          to="/dashboard"
          className={`nav-link ${pathname === "/dashboard" ? "active" : ""}`}
        >
          Dashboard
        </Link>

        <Link
          to="/record"
          className={`nav-link ${pathname === "/record" ? "active" : ""}`}
        >
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
