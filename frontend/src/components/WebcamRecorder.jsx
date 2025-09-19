import React, { useEffect, useRef, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import * as blazeface from "@tensorflow-models/blazeface";

const API_ENDPOINT = "http://localhost:4000/api/session";

const LOOK_AWAY_MS = 5000;
const ABSENT_MS = 10000;
const NOSE_REL_THRESHOLD = 0.28;

const COCO_MIN_SCORE = 0.45;
const COCO_PERSISTENCE_REQUIRED = 2;
const COCO_COOLDOWN_MS = 10000;
const COCO_INTERVAL_MS = 900;
const OFFSCREEN_MAX_WIDTH = 480;
const COCO_MIN_AREA_FRAC = 0.006;

const SUSPICIOUS_CLASS_MAP = {
  phone: ["cell phone", "cellphone", "mobile phone", "phone", "mobile"],
  laptop: ["laptop"],
  monitor: ["monitor", "screen", "computer", "desktop"],
  book: ["book"],
  paper_notes: ["book", "notebook", "notepad", "paper"],
};

export default function WebcamRecorder() {
  // DOM refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const offscreenRef = useRef(null);

  // models
  const faceModelRef = useRef(null);
  const cocoModelRef = useRef(null);

  // timers / raf refs
  const rafRef = useRef(null);
  const faceIntervalRef = useRef(null);
  const cocoIntervalRef = useRef(null);

  // UI & state
  const [username, setUsername] = useState("student_1");
  const [status, setStatus] = useState("starting");
  const [recording, setRecording] = useState(false);
  const recordingRef = useRef(false);
  useEffect(() => { recordingRef.current = recording; }, [recording]);

  const [mirror, setMirror] = useState(false);
  const [cocoLoaded, setCocoLoaded] = useState(false);
  const [facesCount, setFacesCount] = useState(0);

  const [events, setEvents] = useState([]);
  const eventsRef = useRef([]);
  useEffect(() => { eventsRef.current = events; }, [events]);

  const countsRef = useRef({
    absentCount: 0,
    lookAwayCount: 0,
    multipleFacesCount: 0,
    itemCounts: { phone: 0, laptop: 0, monitor: 0, book: 0, paper_notes: 0 },
  });

  const [absentCount, setAbsentCount] = useState(0);
  const [lookAwayCount, setLookAwayCount] = useState(0);
  const [multipleFacesCount, setMultipleFacesCount] = useState(0);
  const [itemCountsState, setItemCountsState] = useState({ phone: 0, laptop: 0, monitor: 0, book: 0, paper_notes: 0 });

  // detection state
  const detectionState = useRef({
    lastFaceSeenAt: Date.now(),
    absentFlagged: false,
    lastLookAwayStart: null,
    lookAwayFlagged: false,
  });

  const cocoPersistence = useRef({});
  const cocoLastLoggedAt = useRef({});

  // ---------- helpers ----------
  function pushEvent(type, meta = {}) {
    const allowedWhenStopped = ["started_recording", "stopped_recording", "session_saved", "session_save_failed"];
    if (!recordingRef.current && !allowedWhenStopped.includes(type)) return;
    const ev = { type, ts: Date.now(), meta };
    setEvents((prev) => {
      const next = [ev, ...prev].slice(0, 500);
      eventsRef.current = next;
      return next;
    });

    // update counts
    if (type === "absent_10s") {
      countsRef.current.absentCount += 1;
      setAbsentCount(countsRef.current.absentCount);
    } else if (type === "look_away_5s") {
      countsRef.current.lookAwayCount += 1;
      setLookAwayCount(countsRef.current.lookAwayCount);
    } else if (type === "multiple_faces") {
      countsRef.current.multipleFacesCount += 1;
      setMultipleFacesCount(countsRef.current.multipleFacesCount);
    } else if (type === "item_detected" && meta?.category) {
      const cat = meta.category;
      countsRef.current.itemCounts[cat] = (countsRef.current.itemCounts[cat] || 0) + 1;
      setItemCountsState({ ...countsRef.current.itemCounts });
    }

    console.debug("EVENT", ev);
  }

  function mapCocoClassToCategories(cocoClass) {
    const cls = (cocoClass || "").toLowerCase();
    const categories = [];
    for (const [cat, subs] of Object.entries(SUSPICIOUS_CLASS_MAP)) {
      for (const sub of subs) {
        if (cls.includes(sub)) {
          categories.push(cat);
          break;
        }
      }
    }
    return categories;
  }

  function makeFullCanvasSnapshotDataURL({ maxW = 640, maxH = 360, quality = 0.66 } = {}) {
    try {
      const main = canvasRef.current;
      if (!main) return null;
      const scale = Math.min(1, Math.min(maxW / main.width, maxH / main.height));
      const sw = Math.max(1, Math.round(main.width * scale));
      const sh = Math.max(1, Math.round(main.height * scale));
      const tmp = document.createElement("canvas");
      tmp.width = sw;
      tmp.height = sh;
      const ctx = tmp.getContext("2d");
      ctx.drawImage(main, 0, 0, main.width, main.height, 0, 0, sw, sh);
      return tmp.toDataURL("image/jpeg", quality);
    } catch (e) {
      console.warn("snapshot failed:", e);
      return null;
    }
  }

  // ---------- recording controls ----------
  const [sessionStart, setSessionStart] = useState(null);

  function startRecording() {
    // resetting counters and events
    setEvents([]);
    eventsRef.current = [];
    countsRef.current = {
      absentCount: 0,
      lookAwayCount: 0,
      multipleFacesCount: 0,
      itemCounts: { phone: 0, laptop: 0, monitor: 0, book: 0, paper_notes: 0 },
    };
    setAbsentCount(0);
    setLookAwayCount(0);
    setMultipleFacesCount(0);
    setItemCountsState({ phone: 0, laptop: 0, monitor: 0, book: 0, paper_notes: 0 });

    const now = new Date();
    setSessionStart(now);
    setRecording(true);
    recordingRef.current = true;
    pushEvent("started_recording", { startTime: now.toISOString(), username });
    setStatus((s) => (s.includes("recording") ? s : s + " | recording"));
  }

  async function stopRecording() {
    setRecording(false);
    recordingRef.current = false;
    const end = new Date();
    pushEvent("stopped_recording", { endTime: end.toISOString() });

    const summary = {
      absentCount: countsRef.current.absentCount,
      lookAwayCount: countsRef.current.lookAwayCount,
      multipleFacesCount: countsRef.current.multipleFacesCount,
      itemCounts: { ...countsRef.current.itemCounts },
    };

    const electronicItemCount =
      (summary.itemCounts.phone || 0) + (summary.itemCounts.laptop || 0) + (summary.itemCounts.monitor || 0);

    const start = sessionStart || new Date();
    const startMs = start instanceof Date ? start.getTime() : new Date(start).getTime();
    const endMs = end.getTime();
    const durationSec = Math.max(0, Math.round((endMs - startMs) / 1000));

    const payload = {
      username,
      startTime: start instanceof Date ? start.toISOString() : new Date(start).toISOString(),
      endTime: end.toISOString(),
      startTimeMs: startMs,
      endTimeMs: endMs,
      startTimeLocal: start.toString(),
      endTimeLocal: end.toString(),
      durationSec,
      events: eventsRef.current || [],
      absentCount: summary.absentCount,
      lookAwayCount: summary.lookAwayCount,
      multipleFacesCount: summary.multipleFacesCount,
      electronicItemCount,
      itemCounts: summary.itemCounts,
      summary,
    };

    setStatus("saving session...");
    try {
      const res = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${text}`);
      }
      const body = await res.json().catch(() => ({}));
      pushEvent("session_saved", { serverResponse: body, summary });
      setStatus("session saved");
      console.log("Session saved:", body);
    } catch (err) {
      console.error("Failed to save session:", err);
      setStatus("save failed");
      pushEvent("session_save_failed", { error: String(err) });
    } finally {
      setTimeout(() => setStatus((s) => s.replace("saving session...", "").replace("save failed", "")), 1800);
    }
  }

  // ---------- Main effect: camera + models + loops ----------
  useEffect(() => {
    let mounted = true;
    let localStream = null;

    async function startup() {
      try {
        setStatus("requesting camera...");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        localStream = stream;
        if (!mounted) {
          try { stream.getTracks().forEach((t) => t.stop()); } catch (e) {}
          return;
        }

        const v = videoRef.current;
        const c = canvasRef.current;
        if (!v) {
          try { stream.getTracks().forEach((t) => t.stop()); } catch (e) {}
          console.warn("videoRef.current missing; aborting camera attach");
          return;
        }

        v.srcObject = stream;
        v.muted = true;
        v.playsInline = true;
        await v.play().catch((e) => console.warn("video.play failed:", e));

        function ensureCanvasSize() {
          if (v.videoWidth && v.videoHeight && c) {
            c.width = v.videoWidth;
            c.height = v.videoHeight;
          }
        }
        v.addEventListener("loadedmetadata", ensureCanvasSize);
        ensureCanvasSize();

        // Draw loop (RAF)
        function drawFrame() {
          try {
            if (!c) return;
            const ctx = c.getContext("2d");
            ctx.clearRect(0, 0, c.width, c.height);
            if (v.readyState >= 2) {
              if (mirror) {
                ctx.save();
                ctx.translate(c.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(v, 0, 0, c.width, c.height);
                ctx.restore();
              } else {
                ctx.drawImage(v, 0, 0, c.width, c.height);
              }
            } else {
              ctx.fillStyle = "#0b1221";
              ctx.fillRect(0, 0, c.width, c.height);
            }

            // overlays
            ctx.fillStyle = "rgba(5,12,20,0.5)";
            ctx.fillRect(12, 12, 460, 34);
            ctx.fillStyle = "#ffffff";
            ctx.font = "13px Inter, system-ui, sans-serif";
            ctx.fillText(`${status}${recordingRef.current ? "  •  REC" : ""}`, 20, 36);
            ctx.fillText(`faces: ${facesCount}`, c.width - 170, 36);
            ctx.fillText(`coco: ${cocoLoaded ? "on" : "off"}`, c.width - 90, 36);

            // draw face preds if available
            if (faceModelRef.current && Array.isArray(faceModelRef.current._lastPreds)) {
              ctx.save();
              ctx.lineWidth = 2;
              ctx.strokeStyle = "#7af58c"; 
              for (const p of faceModelRef.current._lastPreds || []) {
                if (!p?.topLeft || !p?.bottomRight) continue;
                let [x1, y1] = p.topLeft;
                let [x2, y2] = p.bottomRight;
                const w = x2 - x1;
                const h = y2 - y1;
                if (mirror) x1 = c.width - x1 - w;
                if (![x1, y1, w, h].every(Number.isFinite)) continue;
                ctx.strokeRect(x1, y1, w, h);
                if (p.landmarks && p.landmarks.length >= 3) {
                  let nx = p.landmarks[2][0], ny = p.landmarks[2][1];
                  if (mirror) nx = c.width - nx;
                  ctx.fillStyle = "#ffd966"; 
                  ctx.fillRect(nx - 3, ny - 3, 6, 6);
                }
              }
              ctx.restore();
            }

            // draw coco preds if available
            if (cocoModelRef.current && Array.isArray(cocoModelRef.current._lastCocoPreds)) {
              ctx.save();
              ctx.lineWidth = 2;
              ctx.strokeStyle = "#ff7a7a";
              ctx.fillStyle = "rgba(255,122,122,0.16)";
              for (const p of cocoModelRef.current._lastCocoPreds || []) {
                const [bx, by, bw, bh] = p.bbox || [];
                if (![bx, by, bw, bh].every(Number.isFinite)) continue;
                let drawX = bx;
                if (mirror) drawX = c.width - bx - bw;
                ctx.strokeRect(drawX, by, bw, bh);
                ctx.fillRect(drawX, (by > 20 ? by - 20 : by + 2), 120, 18);
                ctx.fillStyle = "#fff";
                ctx.font = "12px Inter, sans-serif";
                ctx.fillText(`${p.class} ${Math.round((p.score || 0) * 100)}%`, drawX + 6, by > 20 ? by - 6 : by + 14);
                ctx.fillStyle = "rgba(255,122,122,0.16)";
              }
              ctx.restore();
            }
          } catch (e) {
          }
          rafRef.current = requestAnimationFrame(drawFrame);
        }
        rafRef.current = requestAnimationFrame(drawFrame);

        // load BlazeFace
        setStatus("loading tf");
        await tf.ready();
        setStatus("loading blazeface");
        try {
          const fModel = await blazeface.load();
          if (!mounted) {
            try { if (typeof fModel.dispose === "function") fModel.dispose(); } catch (e) {}
            return;
          }
          faceModelRef.current = fModel;
          faceModelRef.current._lastPreds = [];
          setStatus("blazeface loaded");
        } catch (err) {
          console.warn("blazeface failed:", err);
          setStatus("blazeface failed");
        }

        // face detection loop
        faceIntervalRef.current = window.setInterval(async () => {
          if (!mounted) return;
          const m = faceModelRef.current;
          const vEl = videoRef.current;
          const cEl = canvasRef.current;
          if (!m || !vEl || vEl.readyState < 2 || !cEl) {
            setFacesCount(0);
            return;
          }
          try {
            const preds = await m.estimateFaces(vEl, false);
            const arr = Array.isArray(preds) ? preds : [];
            m._lastPreds = arr;
            setFacesCount(arr.length);

            if (arr.length > 1 && recordingRef.current) pushEvent("multiple_faces", { count: arr.length });

            // absent detection
            if (arr.length === 0) {
              const since = Date.now() - detectionState.current.lastFaceSeenAt;
              if (!detectionState.current.absentFlagged && since > ABSENT_MS && recordingRef.current) {
                detectionState.current.absentFlagged = true;
                pushEvent("absent_10s", { sinceMs: since });
              }
            } else {
              detectionState.current.lastFaceSeenAt = Date.now();
              detectionState.current.absentFlagged = false;
            }

            // look-away detection using nose landmark
            if (arr.length >= 1) {
              const f = arr[0];
              const [x1] = f.topLeft || [0];
              const [x2] = f.bottomRight || [0];
              const fw = Math.max(1, x2 - x1);
              let rel = 0;
              if (f.landmarks && f.landmarks.length >= 3) {
                let noseX = f.landmarks[2][0];
                if (mirror) noseX = cEl.width - noseX;
                const faceCenterX = (f.topLeft[0] + f.bottomRight[0]) / 2;
                rel = (noseX - faceCenterX) / fw;
              } else {
                let cx = (f.topLeft[0] + f.bottomRight[0]) / 2;
                if (mirror) cx = cEl.width - cx;
                rel = (cx - cEl.width / 2) / (cEl.width / 2);
              }

              const horizOff = Math.abs(rel) > NOSE_REL_THRESHOLD;
              const now = Date.now();
              if (horizOff) {
                if (!detectionState.current.lastLookAwayStart) detectionState.current.lastLookAwayStart = now;
                else {
                  const dur = now - detectionState.current.lastLookAwayStart;
                  if (!detectionState.current.lookAwayFlagged && dur >= LOOK_AWAY_MS && recordingRef.current) {
                    detectionState.current.lookAwayFlagged = true;
                    pushEvent("look_away_5s", { durMs: dur, rel });
                  }
                }
              } else {
                detectionState.current.lastLookAwayStart = null;
                detectionState.current.lookAwayFlagged = false;
              }
            } else {
              detectionState.current.lastLookAwayStart = null;
              detectionState.current.lookAwayFlagged = false;
            }
          } catch (err) {
            console.warn("face loop error:", err);
          }
        }, 320);

        // dynamic coco import 
        setStatus((s) => s + " | loading coco...");
        try {
          const cocoModule = await import("@tensorflow-models/coco-ssd");
          const cocoModel = await cocoModule.load();
          if (!mounted) {
            try { if (typeof cocoModel.dispose === "function") cocoModel.dispose(); } catch (e) {}
            return;
          }
          cocoModelRef.current = cocoModel;
          cocoModelRef.current._lastCocoPreds = [];
          setCocoLoaded(true);
          setStatus("coco loaded");

          // coco detection loop
          cocoIntervalRef.current = window.setInterval(async () => {
            if (!mounted) return;
            const m = cocoModelRef.current;
            const vEl = videoRef.current;
            const cEl = canvasRef.current;
            if (!m || !vEl || vEl.readyState < 2 || !cEl) return;
            try {
              if (!offscreenRef.current || !offscreenRef.current.canvas) {
                const targetW = Math.min(OFFSCREEN_MAX_WIDTH, vEl.videoWidth || cEl.width || 640);
                const scale = targetW / (vEl.videoWidth || cEl.width || 640);
                const targetH = Math.max(1, Math.round((vEl.videoHeight || cEl.height || 480) * scale));
                const offCanvas = document.createElement("canvas");
                offCanvas.width = targetW;
                offCanvas.height = targetH;
                offscreenRef.current = { canvas: offCanvas, ctx: offCanvas.getContext("2d"), width: targetW, height: targetH };
              }
              const off = offscreenRef.current;
              off.ctx.clearRect(0, 0, off.width, off.height);
              if (mirror) {
                off.ctx.save();
                off.ctx.translate(off.width, 0);
                off.ctx.scale(-1, 1);
                off.ctx.drawImage(vEl, 0, 0, off.width, off.height);
                off.ctx.restore();
              } else {
                off.ctx.drawImage(vEl, 0, 0, off.width, off.height);
              }

              const preds = await m.detect(off.canvas);
              const sx = cEl.width / off.width;
              const sy = cEl.height / off.height;
              const mapped = (preds || []).map((p) => {
                const [x, y, w, h] = p.bbox;
                return { ...p, bbox: [x * sx, y * sy, w * sx, h * sy] };
              });

              const frameArea = Math.max(1, cEl.width * cEl.height);
              const goodPreds = mapped.filter((p) => {
                const cls = (p.class || "").toLowerCase();
                if ((p.score || 0) < COCO_MIN_SCORE) return false;
                const [bx, by, bw, bh] = p.bbox || [0, 0, 0, 0];
                if (!Number.isFinite(bx) || !Number.isFinite(bw) || bw <= 0) return false;
                const areaFrac = (bw * bh) / frameArea;
                if (areaFrac < COCO_MIN_AREA_FRAC) return false;
                return true;
              });

              m._lastCocoPreds = goodPreds;

              const categoriesSeenThisCycle = new Set();
              for (const p of goodPreds) {
                const cls = (p.class || "").toLowerCase();
                const mappedCats = mapCocoClassToCategories(cls);
                for (const mc of mappedCats) categoriesSeenThisCycle.add(mc);
                if (mappedCats.length === 0) {
                  const [bx, by, bw, bh] = p.bbox;
                  const aspect = bw / (bh || 1);
                  const areaFrac = (bw * bh) / frameArea;
                  if (areaFrac > 0.003 && (aspect < 0.5 || aspect > 2.0)) categoriesSeenThisCycle.add("phone");
                }
              }

              const now = Date.now();
              for (const cat of Object.keys(SUSPICIOUS_CLASS_MAP)) {
                if (recordingRef.current && categoriesSeenThisCycle.has(cat)) {
                  cocoPersistence.current[cat] = (cocoPersistence.current[cat] || 0) + 1;
                } else {
                  cocoPersistence.current[cat] = 0;
                }

                const count = cocoPersistence.current[cat] || 0;
                const lastLogged = cocoLastLoggedAt.current[cat] || 0;
                const cooldownElapsed = now - lastLogged > COCO_COOLDOWN_MS;
                if (recordingRef.current && count >= COCO_PERSISTENCE_REQUIRED && cooldownElapsed) {
                  let bestPred = null;
                  let bestScore = -1;
                  for (const p of goodPreds) {
                    const mappedCats = mapCocoClassToCategories((p.class || "").toLowerCase());
                    if (mappedCats.includes(cat) && (p.score || 0) > bestScore) {
                      bestScore = p.score;
                      bestPred = p;
                    }
                  }
                  const thumbnail = makeFullCanvasSnapshotDataURL();
                  pushEvent("item_detected", {
                    category: cat,
                    class: bestPred ? bestPred.class : null,
                    score: bestPred ? bestPred.score : null,
                    bbox: bestPred ? bestPred.bbox : null,
                    thumbnail,
                  });
                  cocoLastLoggedAt.current[cat] = now;
                  cocoPersistence.current[cat] = 0;

                  if (["phone", "laptop", "monitor", "book", "paper_notes"].includes(cat)) {
                    pushEvent("locked", { category: cat, ts: now });
                  }
                }
              }
            } catch (err) {
              console.warn("coco loop error:", err);
            }
          }, COCO_INTERVAL_MS);
        } catch (err) {
          console.warn("coco dynamic import failed (optional).", err);
          setCocoLoaded(false);
          setStatus((s) => s + " | coco-not-loaded");
        }
      } catch (err) {
        console.error("startup error:", err);
        setStatus("startup error");
      }
    }

    startup();

    // cleanup function 
    return () => {
      mounted = false;

      try {
        if (rafRef.current && typeof cancelAnimationFrame === "function") {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      } catch (e) {}

      try {
        if (faceIntervalRef.current) clearInterval(faceIntervalRef.current);
        faceIntervalRef.current = null;
      } catch (e) {}

      try {
        if (cocoIntervalRef.current) clearInterval(cocoIntervalRef.current);
        cocoIntervalRef.current = null;
      } catch (e) {}

      try {
        const v = videoRef.current;
        if (v?.srcObject && typeof v.srcObject.getTracks === "function") {
          v.srcObject.getTracks().forEach((t) => {
            try {
              t.stop();
            } catch (e) {}
          });
          v.srcObject = null;
        }
      } catch (e) {
        console.warn("cleanup stop tracks error", e);
      }

      try {
        if (faceModelRef.current && typeof faceModelRef.current.dispose === "function") faceModelRef.current.dispose();
      } catch (e) {}

      try {
        if (cocoModelRef.current && typeof cocoModelRef.current.dispose === "function") cocoModelRef.current.dispose();
      } catch (e) {}

      faceModelRef.current = null;
      cocoModelRef.current = null;
      offscreenRef.current = null;

      console.info("WebcamRecorder cleanup done.");
    };
  }, [mirror]);

  // UI helpers
  function toggleMirror() {
    setMirror((m) => !m);
  }
  function manualUnlock() {
    pushEvent("manual_unlocked", { ts: Date.now() });
  }

  function InfoCard({ title, value, subtitle }) {
    return (
      <div style={{
        padding: 12,
        borderRadius: 10,
        background: "#ffffff",
        boxShadow: "0 8px 24px rgba(8,15,30,0.06)",
        marginBottom: 10,
        border: "1px solid rgba(15,23,42,0.04)"
      }}>
        <div style={{ fontSize: 12, color: "#64748b" }}>{title}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>{value}</div>
        {subtitle ? <div style={{ fontSize: 12, color: "#94a3b8" }}>{subtitle}</div> : null}
      </div>
    );
  }

  const btnStyle = {
    background: "#0f172a",
    color: "#fff",
    border: "none",
    padding: "8px 12px",
    borderRadius: 8,
    cursor: "pointer",
    boxShadow: "0 6px 18px rgba(12,20,40,0.08)",
    fontWeight: 600,
  };
  const btnAltStyle = {
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid rgba(15,23,42,0.06)",
    padding: "8px 12px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  };

  // ---------- rendering part ----------
  return (
    <div style={{ maxWidth: 1180, margin: "18px auto", fontFamily: "Inter, system-ui, -apple-system, Roboto, sans-serif", color: "#0f172a" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, color: "#0b1221" }}>Interview Proctor — Live</h2>
          <div style={{ fontSize: 13, color: "#64748b" }}>Recording gated; events saved on Stop.</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ padding: "6px 10px", borderRadius: 8, background: recording ? "#ffeaea" : "#f1f5f9", color: recording ? "#b91c1c" : "#475569", fontWeight: 700 }}>
            {recording ? "Recording" : "Idle"}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <label style={{ marginRight: 8, color: "#64748b" }}>Username</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.06)", width: 200 }} />
        <button onClick={startRecording} disabled={recording} style={{ ...btnStyle, opacity: recording ? 0.6 : 1 }}>Start</button>
        <button onClick={stopRecording} disabled={!recording} style={{ ...btnStyle, background: "#ef4444", opacity: !recording ? 0.6 : 1 }}>Stop & Save</button>
        <button onClick={toggleMirror} style={btnAltStyle}>{mirror ? "Left is left" : "Selfie (mirror)"}</button>
        <button onClick={manualUnlock} style={btnAltStyle}>Manual Unlock</button>
        <div style={{ marginLeft: 12, color: "#64748b" }}>{status}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "720px 1fr", gap: 18 }}>
        <div>
          <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#0b1221", boxShadow: "0 12px 36px rgba(8,15,30,0.06)" }}>
            <video ref={videoRef} style={{ display: "block", width: "100%", visibility: "hidden" }} playsInline muted />
            <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", background: "#020617" }} />
            {/* subtle top-left badge */}
            <div style={{ position: "absolute", left: 12, top: 12, padding: "6px 8px", borderRadius: 8, background: "linear-gradient(90deg,#0ea5a4,#3b82f6)", color: "#fff", fontSize: 12, fontWeight: 700 }}>
              Proctor View
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <h4 style={{ margin: "6px 0", color: "#0b1221" }}>Events</h4>
            <div style={{ maxHeight: 300, overflow: "auto", border: "1px solid rgba(15,23,42,0.04)", padding: 10, borderRadius: 10, background: "#fff" }}>
              {eventsRef.current.length === 0 ? (
                <div style={{ color: "#94a3b8" }}>No events yet.</div>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {eventsRef.current.map((e, i) => (
                    <li key={i} style={{ display: "flex", gap: 12, padding: "10px 8px", borderBottom: "1px solid rgba(15,23,42,0.03)", alignItems: "center" }}>
                      <div style={{ width: 92, height: 56, background: "#f8fafc", borderRadius: 8, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(15,23,42,0.03)" }}>
                        {e.meta?.thumbnail ? <img src={e.meta.thumbnail} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="thumb" /> : <span style={{ color: "#cbd5e1" }}>—</span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: "#0b1221" }}>{e.type}</div>
                        <div style={{ color: "#64748b", fontSize: 12 }}>{new Date(e.ts).toLocaleTimeString()}</div>
                        {e.meta && Object.keys(e.meta).length ? <div style={{ fontSize: 12, color: "#475569", marginTop: 8 }}>{JSON.stringify(e.meta)}</div> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <aside>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <InfoCard title="Absent (>10s)" value={countsRef.current.absentCount} />
            <InfoCard title="Look-away (>5s)" value={countsRef.current.lookAwayCount} />
            <InfoCard title="Multiple faces" value={countsRef.current.multipleFacesCount} />
            <InfoCard
              title="Electronics"
              value={(countsRef.current.itemCounts.phone || 0) + (countsRef.current.itemCounts.laptop || 0) + (countsRef.current.itemCounts.monitor || 0)}
              subtitle="phone + laptop + monitor"
            />
          </div>

          <div style={{ marginTop: 12, padding: 14, borderRadius: 12, background: "#fff", boxShadow: "0 12px 36px rgba(8,15,30,0.04)" }}>
            <h4 style={{ margin: 0, color: "#0b1221" }}>Item breakdown</h4>
            <ul style={{ listStyle: "none", padding: 0, marginTop: 10, color: "#0b1221" }}>
              <li style={{ marginBottom: 6 }}>Phone: <strong style={{ marginLeft: 8 }}>{(countsRef.current.itemCounts.phone || 0)}</strong></li>
              <li style={{ marginBottom: 6 }}>Laptop: <strong style={{ marginLeft: 8 }}>{(countsRef.current.itemCounts.laptop || 0)}</strong></li>
              <li style={{ marginBottom: 6 }}>Monitor: <strong style={{ marginLeft: 8 }}>{(countsRef.current.itemCounts.monitor || 0)}</strong></li>
              <li style={{ marginBottom: 6 }}>Book: <strong style={{ marginLeft: 8 }}>{(countsRef.current.itemCounts.book || 0)}</strong></li>
              <li>Paper/Notes: <strong style={{ marginLeft: 8 }}>{(countsRef.current.itemCounts.paper_notes || 0)}</strong></li>
            </ul>

            <div style={{ marginTop: 12, color: "#64748b", fontSize: 13 }}>
              Tip: Good lighting and centering the subject improves detection accuracy.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
