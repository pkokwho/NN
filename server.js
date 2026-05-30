require("dotenv").config();

const express = require("express");
const path = require("path");
const aiChat = require("./services/aiChat");

const PORT = parseInt(process.env.PORT || process.env.AI_CHAT_PORT || "3000", 10);
const app = express();

// ── 安全基础中间件 ──
app.use(express.json({ limit: "16kb" }));
app.use(function (req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

// ── CORS（仅允许本站 → 部署前请改成你的域名） ──
const ALLOWED_ORIGINS = [
  "http://localhost:" + PORT,
  "http://127.0.0.1:" + PORT,
  "https://pkokwho.github.io",
  "https://nn-production.up.railway.app"
];
app.use(function (req, res, next) {
  var origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.indexOf(origin) !== -1) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ── 简易频率限制 ──
var requestCounts = {};
var RATE_LIMIT_WINDOW = 60000; // 1 分钟
var RATE_LIMIT_MAX = 20;

app.use("/api/chat", function (req, res, next) {
  var ip = req.ip || req.connection.remoteAddress || "unknown";
  var now = Date.now();
  if (!requestCounts[ip]) requestCounts[ip] = { count: 0, reset: now + RATE_LIMIT_WINDOW };
  if (now > requestCounts[ip].reset) {
    requestCounts[ip] = { count: 0, reset: now + RATE_LIMIT_WINDOW };
  }
  requestCounts[ip].count++;
  if (requestCounts[ip].count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: "请求过于频繁，请稍后再试" });
  }
  next();
});

// ── 静态文件 ──
app.use(express.static(__dirname));

// ── AI 聊天 API ──
/**
 * POST /api/chat
 * Body: { "message": "你好" }
 * 返回: { "reply": "AI的回复", "historyLength": 对话轮次 }
 */
app.post("/api/chat", async function (req, res) {
  try {
    var message = req.body.message;
    var result = await aiChat.sendMessage(message);
    res.json({ reply: result.reply, historyLength: result.historyLength });
  } catch (err) {
    console.error("[Chat Error]", err.message);
    res.status(500).json({ error: err.message || "服务器内部错误" });
  }
});

/**
 * GET /api/chat/history
 * 返回聊天历史记录
 */
app.get("/api/chat/history", function (_req, res) {
  res.json({ history: aiChat.getHistory() });
});

/**
 * DELETE /api/chat/history
 * 清空聊天历史
 */
app.delete("/api/chat/history", function (_req, res) {
  aiChat.clearHistory();
  res.json({ ok: true });
});

// ── 健康检查 ──
app.get("/api/health", function (_req, res) {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ── 404 ──
app.use(function (_req, res) {
  res.status(404).json({ error: "Not Found" });
});

// ── 全局错误处理 ──
app.use(function (err, _req, res, _next) {
  console.error("[Server Error]", err);
  res.status(500).json({ error: "服务器内部错误" });
});

// ── 启动 ──
app.listen(PORT, function () {
  console.log("╔══════════════════════════════════╗");
  console.log("║  个人网站 + AI 智能助手已启动  ║");
  console.log("║  http://localhost:" + PORT + "              ║");
  console.log("╚══════════════════════════════════╝");
});