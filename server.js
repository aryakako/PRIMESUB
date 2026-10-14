// PrimeSub Studio Pro - server (Groq key + access codes + limits + kharcha-log)
// Run: npm i && npm start
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const app = express();
app.set("trust proxy", 1);

const GROQ = process.env.GROQ_BASE || "https://api.groq.com/openai/v1";
const KEY = process.env.GROQ_API_KEY;
const USD_INR = Number(process.env.USD_INR || 90);
const ACCESS_CODES = (process.env.ACCESS_CODES || "").split(",").map(s => s.trim()).filter(Boolean);
const CODE_MINUTES = Number(process.env.CODE_MINUTES || 30);          // har code ke total minutes
const MAX_VIDEO_MINUTES = Number(process.env.MAX_VIDEO_MINUTES || 5); // ek video ki limit
const ADMIN_KEY = process.env.ADMIN_KEY || "";
const DATA_DIR = process.env.DATA_DIR || "./data";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Public links jo .env se aate hain (khali = band). Sirf http(s)/mailto allow.
const safeUrl = u => (/^(https?:\/\/|mailto:)/i.test(String(u || "").trim()) ? String(u).trim() : "");
const FEEDBACK_URL = safeUrl(process.env.FEEDBACK_URL);
const ACCESS_REQUEST_URL = safeUrl(process.env.ACCESS_REQUEST_URL);
const CONTACT_EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(process.env.CONTACT_EMAIL || "") ? process.env.CONTACT_EMAIL : "";

// Groq ke list daam (check karte rehna: groq.com/pricing)
const WHISPER_PER_HOUR = 0.111;                 // har request par kam se kam 10 second ka bill
const CHAT_PRICE = { "openai/gpt-oss-120b": [0.15, 0.75], "openai/gpt-oss-20b": [0.075, 0.30] }; // $/1M [in,out]
const DEFAULT_CHAT_PRICE = [0.15, 0.75];

// ---------- usage store (per access code) ----------
const USAGE_FILE = path.join(DATA_DIR, "usage.json");
let usage = {};
try { usage = JSON.parse(fs.readFileSync(USAGE_FILE, "utf8")); } catch {}
let saveTimer = null;
function saveUsage() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 1)); } catch (e) { console.error("usage save failed:", e.message); }
  }, 500);
}
const u = code => (usage[code] ||= { sec: 0, usd: 0, videos: 0 });

// ---------- har video ka asli kharcha ----------
const videos = new Map();
function track(code, id, add) {
  const cu = u(code);
  cu.usd += add.usd || 0;
  cu.sec += add.userSec || 0;
  saveUsage();
  if (!id) return;
  const vkey = `${code}:${id}`;
  const v = videos.get(vkey) || { audioSec: 0, inTok: 0, outTok: 0, usd: 0, calls: 0, chatCalls: 0 };
  if (v.calls === 0) cu.videos += 1;
  v.audioSec += add.audioSec || 0; v.inTok += add.inTok || 0; v.outTok += add.outTok || 0; v.usd += add.usd || 0; v.calls += 1; if (add.inTok) v.chatCalls += 1;
  videos.set(vkey, v);
  if (videos.size > 300) videos.delete(videos.keys().next().value);
  console.log(`[cost] ${code} video ${id} | audio ${Math.round(v.audioSec)}s | tokens ${v.inTok} in / ${v.outTok} out | ${v.calls} calls | ~ $${v.usd.toFixed(4)} = Rs ${(v.usd * USD_INR).toFixed(2)}`);
}

// ---------- basic security headers ----------
app.use((req, res, next) => {
  res.set({ "X-Content-Type-Options": "nosniff", "X-Frame-Options": "SAMEORIGIN", "Referrer-Policy": "strict-origin-when-cross-origin" });
  next();
});

// ---------- rate limit (per IP) ----------
const hits = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const now = Date.now(), k = req.ip;
    const arr = (hits.get(k) || []).filter(t => now - t < windowMs);
    if (arr.length >= max) return res.status(429).json({ error: "Too many requests. Please try again shortly." });
    arr.push(now); hits.set(k, arr);
    next();
  };
}
setInterval(() => { const now = Date.now(); for (const [k, a] of hits) if (!a.some(t => now - t < 600000)) hits.delete(k); }, 300000);

// ---------- access code check ----------
function auth(req, res, next) {
  if (ACCESS_CODES.length === 0) { req.code = "open"; return next(); }   // code set nahi hai -> sab khule (sirf local testing)
  const code = String(req.headers["x-access-code"] || "").trim();
  if (!ACCESS_CODES.includes(code)) return res.status(401).json({ error: "Invalid access code." });
  req.code = code;
  next();
}
const leftSec = code => Math.max(0, CODE_MINUTES * 60 - u(code).sec);

app.get("/health", (req, res) => res.send("ok"));
app.get("/api/config", (req, res) => res.json({
  requireCode: ACCESS_CODES.length > 0,
  maxVideoMinutes: MAX_VIDEO_MINUTES,
  feedbackUrl: FEEDBACK_URL,
  accessRequestUrl: ACCESS_REQUEST_URL,
  contactEmail: CONTACT_EMAIL,
}));
app.get("/api/me", rateLimit(60, 600000), auth, (req, res) =>
  res.json({ minutesLeft: Math.round(leftSec(req.code) / 6) / 10, minutesTotal: CODE_MINUTES, maxVideoMinutes: MAX_VIDEO_MINUTES }));

app.get("/api/admin/usage", (req, res) => {
  if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) return res.status(401).json({ error: "no" });
  const rows = Object.entries(usage).map(([code, v]) => ({ code, minutesUsed: +(v.sec / 60).toFixed(1), videos: v.videos, costRs: +(v.usd * USD_INR).toFixed(2) }));
  res.json({ totalCostRs: +rows.reduce((s, r) => s + r.costRs, 0).toFixed(2), rows });
});

// ---------- proxies ----------
const raw = express.raw({ type: () => true, limit: "30mb" });
const API_LIMIT = rateLimit(Number(process.env.RATE_LIMIT || 120), 600000);

app.post("/api/transcribe", API_LIMIT, auth, raw, async (req, res) => {
  if (!KEY) return res.status(500).json({ error: "GROQ_API_KEY missing in .env" });
  const vid = req.headers["x-video-id"];
  const vv = videos.get(`${req.code}:${vid}`);
  // minutes ki jaanch sirf naye video ke shuru me (chalte video ko beech me nahi rokte)
  if (req.code !== "open" && !vv && leftSec(req.code) <= 0) return res.status(402).json({ error: "You have used all your minutes." });
  const isRetry = req.headers["x-retry"] === "1";
  if (vv && vv.audioSec > MAX_VIDEO_MINUTES * 60 * 1.3) return res.status(413).json({ error: `Videos are limited to ${MAX_VIDEO_MINUTES} minutes.` });
  try {
    const r = await fetch(`${GROQ}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": req.headers["content-type"] },
      body: req.body,
    });
    const text = await r.text();
    if (!r.ok) console.error(`Groq transcribe -> ${r.status}:`, text.slice(0, 300));
    else {
      try {
        const dur = Number(JSON.parse(text).duration) || 0;
        track(req.code, vid, { audioSec: dur, userSec: isRetry ? 0 : dur, usd: (Math.max(10, dur) / 3600) * WHISPER_PER_HOUR });
      } catch {}
    }
    res.status(r.status).type(r.headers.get("content-type") || "application/json").send(text);
  } catch (e) {
    console.error("Proxy error:", e.message);
    res.status(502).json({ error: "upstream failed" });
  }
});

// llama-3.3-70b-versatile Groq par 16 Aug 2026 ko band ho chuka hai -> naye models
const CHAT_MODELS = [process.env.GROQ_CHAT_MODEL, "openai/gpt-oss-120b", "qwen/qwen3.6-27b", "openai/gpt-oss-20b"].filter(Boolean);

app.post("/api/chat", API_LIMIT, auth, raw, async (req, res) => {
  if (!KEY) return res.status(500).json({ error: "GROQ_API_KEY missing in .env" });
  const cvid = req.headers["x-video-id"];
  const cv = videos.get(`${req.code}:${cvid}`);
  if (req.code !== "open" && !cv && leftSec(req.code) <= 0) return res.status(402).json({ error: "You have used all your minutes." });
  if (cv && cv.chatCalls >= 60) return res.status(429).json({ error: "The AI request limit for this video has been reached." });
  let body;
  try { body = JSON.parse(req.body.toString()); } catch { return res.status(400).json({ error: "bad json" }); }
  // sirf messages aur response_format aage jaane do (koi aur param ya model client nahi badal sakta)
  const safe = { messages: body.messages, response_format: body.response_format, max_completion_tokens: Math.min(Number(body.max_completion_tokens) || 4000, 6000) };
  let last = { status: 502, text: '{"error":"no model worked"}' };
  for (const model of CHAT_MODELS) {
    try {
      const payload = { ...safe, model, temperature: 0 };
      if (model.startsWith("openai/gpt-oss")) payload.reasoning_effort = "low";
      const r = await fetch(`${GROQ}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await r.text();
      if (r.ok) {
        try {
          const us = JSON.parse(text).usage || {};
          const [pin, pout] = CHAT_PRICE[model] || DEFAULT_CHAT_PRICE;
          const inTok = us.prompt_tokens || 0, outTok = us.completion_tokens || 0;
          track(req.code, req.headers["x-video-id"], { inTok, outTok, usd: (inTok * pin + outTok * pout) / 1e6 });
        } catch {}
        return res.status(200).type("application/json").send(text);
      }
      console.error(`Groq chat [${model}] -> ${r.status}:`, text.slice(0, 300));
      last = { status: r.status, text };
    } catch (e) { console.error(`Groq chat [${model}] error:`, e.message); }
  }
  res.status(last.status).type("application/json").send(last.text);
});

app.use((err, req, res, next) => { console.error(err.message); res.status(err.status || 500).json({ error: err.message }); });
// editor /app par, landing page / par. HTML hamesha taaza (cache nahi) taaki updates turant dikhein.
app.get("/app", (req, res) => res.set("Cache-Control", "no-cache").sendFile(path.join(__dirname, "public", "app.html")));
app.use(express.static(path.join(__dirname, "public"), {
  setHeaders: (res, p) => { if (p.endsWith(".html")) res.set("Cache-Control", "no-cache"); },
}));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PrimeSub on http://localhost:${PORT}  | access codes: ${ACCESS_CODES.length || "OFF (sab khule)"}`));
