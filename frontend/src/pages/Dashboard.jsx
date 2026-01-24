import React, { useEffect, useState } from "react";
import SessionCard from "../components/SessionCard";
import "./dashboard.css";

/**
 * CHANGE THIS ONLY IF BACKEND URL CHANGES
 */
const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://nodejs-production-23f4.up.railway.app";

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  // --------------------
  // SAFE JSON FETCH
  // --------------------
  async function safeFetchJSON(url) {
    const res = await fetch(url, { credentials: "include" });

    const text = await res.text(); // read raw first

    if (!res.ok) {
      console.error("❌ API ERROR:", res.status, text);
      throw new Error("API request failed");
    }

    try {
      return JSON.parse(text);
    } catch {
      console.error("❌ NOT JSON RESPONSE:", text);
      throw new Error("Invalid JSON response");
    }
  }

  // --------------------
  // LOAD SUMMARY
  // --------------------
  async function loadSummary() {
    try {
      const data = await safeFetchJSON(`${API_BASE}/api/dashboard/summary`);
      setSummary(data);
    } catch (err) {
      console.error("Summary load failed", err);
    }
  }

  // --------------------
  // LOAD SESSION LIST
  // --------------------
  async function loadSessions() {
    try {
      const data = await safeFetchJSON(
        `${API_BASE}/api/dashboard/sessions?limit=25`,
      );
      setSessions(data.sessions || []);
    } catch (err) {
      console.error("Sessions load failed", err);
    } finally {
      setLoading(false);
    }
  }

  // --------------------
  // LOAD FULL SESSION
  // --------------------
  async function openSessionReport(sessionId) {
    setDetailLoading(true);
    setSelected(null);

    try {
      const data = await safeFetchJSON(
        `${API_BASE}/api/dashboard/sessions/${sessionId}`,
      );
      setSelected(data);
    } catch (err) {
      console.error("Session report failed", err);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    loadSummary();
    loadSessions();
  }, []);

  return (
    <div className="dash-container">
      <h1 className="dash-title">Proctor Dashboard</h1>

      <div className="dash-cards">
        <Card title="Total Sessions" value={summary?.totalSessions} />
        <Card title="Active Sessions" value={summary?.activeSessions} />
        <Card title="Suspicious Sessions" value={summary?.suspiciousSessions} />
        <Card title="Avg Duration (sec)" value={summary?.avgDurationSec} />
      </div>

      <h2 className="dash-subtitle">Recent Sessions</h2>

      {loading ? (
        <p>Loading sessions...</p>
      ) : (
        <div className="dash-sessions">
          {sessions.map((s) => (
            <SessionCard
              key={s._id}
              session={s}
              onView={() => openSessionReport(s._id)}
            />
          ))}
        </div>
      )}

      {(detailLoading || selected) && (
        <div className="dash-modal-overlay" onClick={() => setSelected(null)}>
          <div className="dash-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dash-modal-header">
              <h3>Session Report</h3>
              <button onClick={() => setSelected(null)}>✕</button>
            </div>

            <div className="dash-modal-body">
              {detailLoading ? (
                <p>Loading...</p>
              ) : (
                <>
                  <p>
                    <b>User:</b> {selected.username}
                  </p>
                  <p>
                    <b>Status:</b> {selected.status}
                  </p>
                  <p>
                    <b>Risk Score:</b> {selected.suspiciousScore}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ title, value }) {
  return (
    <div className="dash-card">
      <div className="dash-card-title">{title}</div>
      <div className="dash-card-value">{value ?? "-"}</div>
    </div>
  );
}
