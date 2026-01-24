const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    username: String,

    startTime: Date,
    endTime: Date,
    durationSec: Number,

    absentCount: Number,
    lookAwayCount: Number,
    multipleFacesCount: Number,
    electronicItemCount: Number,

    events: Array,
  },
  { timestamps: true },
);

// IMPORTANT: explicitly bind to "sessions" collection
module.exports = mongoose.model("Session", sessionSchema, "sessions");
