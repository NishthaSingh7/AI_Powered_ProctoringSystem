# AI-Powered Proctoring System

Real-time AI exam monitoring using **computer vision in the browser** — detects face anomalies, suspicious objects, tab switching, and builds a risk score for each session.

**Portfolio:** [nishthasinghportfolio.netlify.app](https://nishthasinghportfolio.netlify.app/)

## What it detects

- 👤 Candidate absence (no face > 10 seconds)
- 👀 Look-away for more than 5 seconds
- 👥 Multiple faces in frame
- 📱 Unauthorized items via COCO-SSD (phone, laptop, book, notes, monitor)
- 🗂️ Tab switching and screen minimization (browser activity tracking)

## Features

- Real-time **face detection** with BlazeFace (TensorFlow.js)
- **Look-away detection** using nose landmark offset
- **Suspicious item detection** with COCO-SSD
- **Event logging** with timestamps and thumbnails
- **Session summary** with risk counts
- **MongoDB persistence** via Node.js/Express backend
- Admin-friendly session data for review

## Architecture

```
Frontend (React + TensorFlow.js)     Backend (Node.js + Express)     MongoDB Atlas
────────────────────────────────     ───────────────────────────     ─────────────
Webcam access                        POST /api/session               Session docs
BlazeFace + COCO-SSD in browser  →   Validate & store events    →   Events + summaries
Live event dashboard                 REST API                      Risk analytics
```

## Tech stack

- **Frontend:** React (Vite), TensorFlow.js, BlazeFace, COCO-SSD
- **Backend:** Node.js, Express, Mongoose
- **Database:** MongoDB Atlas

## Run locally

### 1. Clone
```bash
git clone https://github.com/NishthaSingh7/AI_Powered_ProctoringSystem.git
cd AI_Powered_ProctoringSystem
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
→ http://localhost:5173

### 3. Backend
```bash
cd backend
npm install
npm start
```
→ http://localhost:4000

## API

**POST** `/api/session` — save a proctoring session

```json
{
  "username": "student_1",
  "startTime": "2025-09-19T10:15:00Z",
  "endTime": "2025-09-19T10:45:00Z",
  "durationSec": 1800,
  "events": [
    { "type": "look_away_5s", "ts": 1695110123000 },
    { "type": "item_detected", "meta": { "category": "phone" } }
  ],
  "absentCount": 1,
  "lookAwayCount": 3,
  "multipleFacesCount": 2,
  "electronicItemCount": 4
}
```

## Project structure

```
├── frontend/               # React + TensorFlow.js client
│   └── src/components/
│       └── WebcamRecorder.jsx
├── backend/                # Node.js + Express server
│   ├── server.js
│   └── models/Session.js
└── README.md
```

## Related work

Integrated into [Nish-Ed](https://github.com/NishthaSingh7/nish-educates) — a full-stack learning platform with secure online assessments.

---

Built by **Nishtha Singh**
