console.log("🔥🔥🔥 THIS IS THE REAL SERVER.JS 🔥🔥🔥");

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

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

/* ✅ THIS handles OPTIONS automatically */
app.use(express.json());
app.get("/api/test", (req, res) => {
  res.json({ ok: true, env: "railway" });
});

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
app.use("/api/dashboard", dashboardRouter);

app.post("/api/session", async (req, res) => {
  try {
    console.log("📥 SESSION RECEIVED");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

/* ❌ NO app.options('*') */
/* ❌ NO wildcard routes */
/* ❌ NO manual OPTIONS handler */

/* ================== START ================== */
const PORT = process.env.PORT || 3000;
console.log("🔥 Dashboard routes loaded");

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});

/* ================== DB ================== */
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((e) => console.error("❌ MongoDB error:", e.message));
