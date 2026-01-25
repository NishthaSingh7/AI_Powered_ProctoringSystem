import React, { useEffect, useState } from "react";
import SessionCard from "../components/SessionCard";
import "./dashboard.css";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://aiproctor-backend-production.up.railway.app";

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  async function safeFetchJSON(url) {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error("API failed");
    return res.json();
  }

  async function loadSummary() {
    const data = await safeFetchJSON(`${API_BASE}/api/dashboard/summary`);
    setSummary(data);
  }

  async function loadSessions() {
    try {
      const data = await safeFetchJSON(
        `${API_BASE}/api/dashboard/sessions?limit=25`,
      );
      setSessions(data.sessions || []);
    } finally {
      setLoading(false);
    }
  }

  async function openSessionReport(id) {
    setDetailLoading(true);
    setSelected(null);
    const data = await safeFetchJSON(
      `${API_BASE}/api/dashboard/sessions/${id}`,
    );
    setSelected(data);
    setDetailLoading(false);
  }

  useEffect(() => {
    loadSummary();
    loadSessions();
  }, []);

  return (
    <div className="dash-root">
      <h1 className="dash-title">Proctor Dashboard</h1>

      {/* SUMMARY */}
      <div className="dash-summary">
        <SummaryCard title="Total Sessions" value={summary?.totalSessions} />
        <SummaryCard title="Active Sessions" value={summary?.activeSessions} />
        <SummaryCard title="Suspicious" value={summary?.suspiciousSessions} />
        <SummaryCard
          title="Avg Duration (sec)"
          value={summary?.avgDurationSec}
        />
      </div>

      <h2 className="dash-section">Recent Sessions</h2>

      {loading ? (
        <p className="dash-loading">Loading sessions…</p>
      ) : (
        <div className="dash-session-grid">
          {sessions.map((s) => (
            <SessionCard
              key={s._id}
              session={s}
              onView={() => openSessionReport(s._id)}
            />
          ))}
        </div>
      )}

      {/* MODAL */}
      {(detailLoading || selected) && (
        <div className="dash-modal-overlay" onClick={() => setSelected(null)}>
          <div className="dash-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dash-modal-header">
              <h3>Session Report</h3>
              <button onClick={() => setSelected(null)}>✕</button>
            </div>

            <div className="dash-modal-body">
              {detailLoading ? (
                <p>Loading…</p>
              ) : (
                <>
                  <p>
                    <b>User:</b> {selected.username}
                  </p>
                  <p>
                    <b>Started:</b>{" "}
                    {new Date(selected.startTime).toLocaleString()}
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

function SummaryCard({ title, value }) {
  return (
    <div className="summary-card">
      <span>{title}</span>
      <strong>{value ?? "-"}</strong>
    </div>
  );
}
