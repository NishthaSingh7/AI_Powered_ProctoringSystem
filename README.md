# AI_Powered_ProctoringSystem

## Project name
AI-Powered Proctoring System

## Year
2025

## Purpose
Real-time AI exam monitoring that uses computer vision in the browser to detect face anomalies, suspicious objects, and tab switching, then builds a risk score for each session.

## Features
- Candidate absence detection (no face for extended periods)
- Look-away detection via face landmarks
- Multiple-face detection in frame
- Unauthorized item detection with COCO-SSD (phone, laptop, book, notes, monitor)
- Tab switching / screen minimization tracking
- Event logging with timestamps
- Session summary with risk counts
- MongoDB persistence through a Node.js/Express API

## Tech Stack used
- Frontend: React, Vite, TensorFlow.js, BlazeFace, COCO-SSD
- Backend: Node.js, Express, Mongoose
- Database: MongoDB Atlas

## Project link
Portfolio showcase: https://nishthasinghportfolio.netlify.app/  
Repository: https://github.com/NishthaSingh7/AI_Powered_ProctoringSystem
