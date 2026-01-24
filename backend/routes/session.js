const express = require("express");
const router = express.Router();
const Session = require("../models/Session");

/**
 * POST /api/session
 * SAVE PROCTORING SESSION
 */
router.post("/", async (req, res) => {
  try {
    const session = new Session(req.body);
    await session.save();

    res.json({
      success: true,
      sessionId: session._id,
    });
  } catch (err) {
    console.error("SESSION SAVE ERROR:", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

module.exports = router;
