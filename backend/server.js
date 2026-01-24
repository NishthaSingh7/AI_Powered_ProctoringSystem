console.log("🔥🔥🔥 NEW SERVER VERSION DEPLOYED 🔥🔥🔥");

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const Session = require("./models/Session");

const app = express();

/* ================== CORS ================== */
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://nodejs-production-23f4.up.railway.app",
    ],
    credentials: true,
  }),
);

app.use(express.json({ limit: "90mb" }));
app.use(express.urlencoded({ extended: true, limit: "90mb" }));

/* ================== LOG ================== */
app.use((req, res, next) => {
  console.log(new Date().toISOString(), req.method, req.originalUrl);
  next();
});

/* ================== HEALTH ================== */
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

/* ================== ROUTES ================== */
const dashboardRouter = require("./routes/dashboard");
const sessionRouter = require("./routes/session");

app.use("/api/dashboard", dashboardRouter);
app.use("/api/session", sessionRouter);

// routes/dashboard.js (or wherever this route is)

app.get("/api/dashboard/sessions/:id", async (req, res) => {
  const session = await Session.findById(req.params.id);
  if (!session) return res.status(404).json({ error: "Not found" });

  // 🔥 RISK CALCULATION (same logic everywhere)
  const score =
    session.lookAwayCount * 0.2 +
    session.absentCount * 0.3 +
    session.multipleFacesCount * 0.3 +
    session.electronicItemCount * 0.2;

  const suspiciousScore = Math.min(1, score);

  const status =
    suspiciousScore >= 0.75
      ? "suspicious"
      : suspiciousScore >= 0.3
        ? "warning"
        : "normal";

  res.json({
    ...session.toObject(),
    suspiciousScore,
    status,
  });
});

console.log("🔥 Dashboard + Session routes loaded");

/* ================== START ================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});

/* ================== DB ================== */
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((e) => console.error("❌ MongoDB error:", e.message));
