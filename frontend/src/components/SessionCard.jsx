import "./sessionCard.css";
import { useEffect, useState } from "react";

export default function SessionCard({ session, onView }) {
  const user = session.user || session.username || "Unknown User";
  const startedAt = session.startedAt || session.startTime;

  const counts = session.counts || {};
  const lookAway = counts.lookAway ?? session.lookAwayCount ?? 0;
  const absent = counts.absent ?? session.absentCount ?? 0;
  const faces = counts.multipleFaces ?? session.multipleFacesCount ?? 0;
  const electronic = counts.electronicItem ?? session.electronicItemCount ?? 0;

  // 🔢 derive score
  const derivedScore =
    lookAway * 0.1 + absent * 0.3 + faces * 0.25 + electronic * 0.15;

  const suspiciousScore =
    session.suspiciousScore !== undefined
      ? session.suspiciousScore
      : derivedScore;

  // 🔥 normalize
  const MAX_SCORE = 3;
  const normalized = Math.min(suspiciousScore / MAX_SCORE, 1);

  const risk =
    normalized >= 0.75 ? "high" : normalized >= 0.4 ? "medium" : "low";

  // 🔥 animation state
  const [fillWidth, setFillWidth] = useState(0);

  useEffect(() => {
    // allow first paint, then animate
    requestAnimationFrame(() => {
      setFillWidth(normalized * 100);
    });
  }, [normalized]);

  return (
    <div className={`session-card ${risk}`}>
      {/* HEADER */}
      <div className="card-header">
        <div>
          <h4>{user}</h4>
          <span>{startedAt ? new Date(startedAt).toLocaleString() : "-"}</span>
        </div>
        <div className={`risk-pill ${risk}`}>{risk.toUpperCase()}</div>
      </div>

      {/* METRICS */}
      <div className="metric-grid">
        <div className="metric">
          <label>👀 Look Away</label>
          <strong>{lookAway}</strong>
        </div>
        <div className="metric">
          <label>❌ Absent</label>
          <strong>{absent}</strong>
        </div>
        <div className="metric">
          <label>👥 Faces</label>
          <strong>{faces}</strong>
        </div>
        <div className="metric">
          <label>📱 Electronic</label>
          <strong>{electronic}</strong>
        </div>
      </div>

      {/* RISK BAR */}
      <div className="risk-row">
        <div className="score-label">Risk Index</div>

        <div className="risk-track">
          <div className="risk-fill" style={{ width: `${fillWidth}%` }} />
          <span className="risk-value">{suspiciousScore.toFixed(2)}</span>
        </div>
      </div>

      {/* CTA */}
      <button className="view-btn" onClick={() => onView(session._id)}>
        View Full Report →
      </button>
    </div>
  );
}
