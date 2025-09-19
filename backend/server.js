require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));


const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("Please set MONGO_URI in .env");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

const sessionSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    durationSec: { type: Number, required: true },
    events: { type: Array, default: [] },

    // explicit counts
    absentCount: { type: Number, default: 0 },
    lookAwayCount: { type: Number, default: 0 },
    multipleFacesCount: { type: Number, default: 0 },
    electronicItemCount: { type: Number, default: 0 },

    // breakdown of items
    itemCounts: {
      phone: { type: Number, default: 0 },
      laptop: { type: Number, default: 0 },
      monitor: { type: Number, default: 0 },
      book: { type: Number, default: 0 },
      paper_notes: { type: Number, default: 0 },
    },

    summary: { type: Object, default: {} },
  },
  { timestamps: true }
);

const Session = mongoose.model("Session", sessionSchema);


function normalizePayload(body = {}) {
  const username = body.username || "unknown";
  const startTime = body.startTime ? new Date(body.startTime) : new Date();
  const endTime = body.endTime ? new Date(body.endTime) : new Date();
  const durationSec =
    Number(body.durationSec) ||
    Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 1000));

  const events = Array.isArray(body.events) ? body.events : [];

  const absentCount = Number(
    body.absentCount ?? (body.summary?.absentCount ?? 0)
  );
  const lookAwayCount = Number(
    body.lookAwayCount ?? (body.summary?.lookAwayCount ?? 0)
  );
  const multipleFacesCount = Number(
    body.multipleFacesCount ?? (body.summary?.multipleFacesCount ?? 0)
  );

  const itemCountsRaw = body.itemCounts ?? body.summary?.itemCounts ?? {};
  const phone = Number(itemCountsRaw.phone ?? 0);
  const laptop = Number(itemCountsRaw.laptop ?? 0);
  const monitor = Number(itemCountsRaw.monitor ?? 0);
  const book = Number(itemCountsRaw.book ?? 0);
  const paper_notes = Number(itemCountsRaw.paper_notes ?? itemCountsRaw.notes ?? 0);

  const electronicItemCount =
    Number(body.electronicItemCount ?? (phone + laptop + monitor));

  const summary = body.summary ?? {
    absentCount,
    lookAwayCount,
    multipleFacesCount,
    itemCounts: { phone, laptop, monitor, book, paper_notes },
  };

  return {
    username,
    startTime,
    endTime,
    durationSec,
    events,
    absentCount,
    lookAwayCount,
    multipleFacesCount,
    electronicItemCount,
    itemCounts: { phone, laptop, monitor, book, paper_notes },
    summary,
  };
}

// POST save session
app.post("/api/session", async (req, res) => {
  try {
    const payload = normalizePayload(req.body);
    const doc = new Session(payload);
    const saved = await doc.save();
    return res.json({ success: true, id: saved._id, saved });
  } catch (err) {
    console.error("Error saving session:", err);
    return res.status(500).json({ success: false, error: String(err) });
  }
});

// GET list (most recent first)
app.get("/api/sessions", async (req, res) => {
  try {
    const docs = await Session.find().sort({ createdAt: -1 }).limit(200).lean();
    return res.json({ success: true, sessions: docs });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err) });
  }
});

// GET single
app.get("/api/session/:id", async (req, res) => {
  try {
    const doc = await Session.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ success: false, error: "not found" });
    return res.json({ success: true, session: doc });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
