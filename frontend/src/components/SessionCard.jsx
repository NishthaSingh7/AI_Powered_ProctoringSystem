export default function SessionCard({ session, onView }) {
  const risk =
    session.suspiciousScore >= 0.75
      ? "high"
      : session.suspiciousScore >= 0.3
        ? "medium"
        : "low";

  const riskColor =
    risk === "high" ? "#ef4444" : risk === "medium" ? "#f59e0b" : "#22c55e";

  return (
    <div className="session-card">
      <div className="session-header">
        <div>
          <h3>{session.user}</h3>
          <p>{new Date(session.startedAt).toLocaleString()}</p>
        </div>

        <span className="risk-badge" style={{ background: riskColor }}>
          {risk.toUpperCase()}
        </span>
      </div>

      <div className="session-metrics">
        <div>👀 Look Away: {session.counts.lookAway}</div>
        <div>❌ Absent: {session.counts.absent}</div>
        <div>👥 Faces: {session.counts.multipleFaces}</div>
        <div>📱 Electronic: {session.counts.electronicItem}</div>
      </div>

      <div className="score-bar">
        <div
          className="score-fill"
          style={{ width: `${session.suspiciousScore * 100}%` }}
        />
        <span>{session.suspiciousScore}</span>
      </div>

      <button onClick={() => onView(session._id)}>View Full Report</button>
    </div>
  );
}
