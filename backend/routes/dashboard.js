const express = require("express");
const router = express.Router();
const Session = require("../models/Session");

console.log("🔥 Dashboard routes loaded");

router.get("/summary", async (req, res) => {
  try {
    const totalSessions = await Session.countDocuments();
    const suspiciousSessions = await Session.countDocuments({
      $or: [
        { lookAwayCount: { $gt: 0 } },
        { absentCount: { $gt: 0 } },
        { multipleFacesCount: { $gt: 0 } },
        { electronicItemCount: { $gt: 0 } },
      ],
    });

    const avgAgg = await Session.aggregate([
      { $group: { _id: null, avg: { $avg: "$durationSec" } } },
    ]);

    res.json({
      totalSessions,
      activeSessions: 0,
      suspiciousSessions,
      avgDurationSec: Math.round(avgAgg[0]?.avg || 0),
    });
  } catch (err) {
    console.error("SUMMARY ERROR", err);
    res.status(500).json({ error: "summary failed" });
  }
});

router.get("/sessions", async (req, res) => {
  try {
    const sessions = await Session.find()
      .sort({ startTime: -1 })
      .limit(25)
      .lean();

    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: "sessions failed" });
  }
});

router.get("/sessions/:id", async (req, res) => {
  try {
    const session = await Session.findById(req.params.id).lean();
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const suspiciousScore =
      (session.lookAwayCount || 0) * 0.25 +
      (session.absentCount || 0) * 0.25 +
      (session.multipleFacesCount || 0) * 0.25 +
      (session.electronicItemCount || 0) * 0.25;

    const status = suspiciousScore > 0 ? "suspicious" : "completed";

    const response = {
      _id: session._id,
      username: session.username,
      startTime: session.startTime,
      endTime: session.endTime,
      durationSec: session.durationSec,

      status, // ✅ REQUIRED
      suspiciousScore: Number(suspiciousScore.toFixed(2)), // ✅ REQUIRED

      counts: {
        lookAway: session.lookAwayCount || 0,
        absent: session.absentCount || 0,
        multipleFaces: session.multipleFacesCount || 0,
        electronicItem: session.electronicItemCount || 0,
      },

      events: session.events || [],
    };

    console.log("🔥 SESSION DETAIL RESPONSE:", response);
    res.json(response);
  } catch (err) {
    console.error("SESSION DETAIL ERROR", err);
    res.status(500).json({ error: "failed to fetch session detail" });
  }
});



module.exports = router;
