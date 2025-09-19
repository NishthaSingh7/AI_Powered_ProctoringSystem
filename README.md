# 🎥 AI-Powered Interview/Exam Proctoring System

An AI-based online proctoring system that monitors candidates during online exams or interviews using **computer vision**.  
The system ensures fairness and prevents cheating by detecting suspicious activities in real-time such as:

- 👤 Candidate absence
- 👀 Look-away for more than 5 seconds
- 👥 Multiple faces detected
- 📱📚 Unauthorized items (phones, laptops, books, notes, monitors)

---

## 🚀 Features
- Real-time **face detection** with BlazeFace
- **Look-away detection** using nose landmark offset
- **Absent detection** if no face >10 seconds
- **Multiple faces** alert if >1 detected
- **Suspicious item detection** with Coco-SSD (phones, laptops, monitors, books, notes)
- **Event logging** with timestamps & thumbnails
- **Session summary** with counts (absent, look-away, items)
- **MongoDB persistence** via Node.js/Express backend

---

## 🏗️ System Architecture
**Frontend (React + TensorFlow.js)**  
- Access webcam & run ML models in browser  
- Detect faces & objects  
- Log events + live UI dashboard  
- Send session data to backend  

**Backend (Node.js + Express)**  
- REST API endpoint `/api/session`  
- Stores session data into MongoDB Atlas  
- Responds with session confirmation  

**Database (MongoDB Atlas)**  
- Stores session documents including:  
  - Username  
  - Start/End times, duration  
  - Event logs with timestamps & thumbnails  
  - Summary counts (absent, look-away, suspicious items)

---

## 📂 Project Structure
```
proctoring-system/
│── frontend/               # React + TensorFlow.js client
│   ├── src/components/
│   │   └── WebcamRecorder.jsx
│   └── package.json
│
│── backend/                # Node.js + Express server
│   ├── server.js
│   ├── models/Session.js
│   └── package.json
│
│── README.md
```

---

## ⚙️ Tech Stack
- **Frontend**: React (Vite), TensorFlow.js, BlazeFace, Coco-SSD  
- **Backend**: Node.js, Express.js, Mongoose  
- **Database**: MongoDB Atlas (cloud-hosted)  

---

## 🖥️ Installation & Setup

### 1️⃣ Clone the repo
```bash
git clone https://github.com/yourusername/proctoring-system.git
cd proctoring-system
```

### 2️⃣ Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:5173/`

### 3️⃣ Backend Setup
```bash
cd backend
npm install
npm start
```
Backend runs on `http://localhost:4000/`

---

## 🔗 API Endpoint
- **POST** `/api/session`  
  Save a session to the database.

**Example Payload:**
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
  "electronicItemCount": 4,
  "itemCounts": { "phone": 2, "laptop": 1, "monitor": 1, "book": 2, "paper_notes": 1 }
}
```

---

## 📊 Sample Proctoring Report
**Candidate:** student_1  
- Duration: 30 min 29 sec  
- Absent: 1  
- Look-away: 3  
- Multiple faces: 2  
- Electronic items: 4  

**Conclusion:** Candidate was inattentive at times and used suspicious items. Flagged for review.

---

## 🔮 Future Improvements
- Admin dashboard for report viewing
- Audio monitoring (detect background conversation)
- More accurate custom-trained object detection models
- Deployment: Netlify/Vercel (frontend) + Render/Heroku (backend)

---

## 👩‍💻 Author
**Nishtha Singh**  
_Project created as part of Interview/Exam Proctoring research & development._
