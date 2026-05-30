require("dotenv").config();

const express = require("express");
const path = require("path");
const rateLimit = require("express-rate-limit");
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

// ── 速率限制：每个 IP 每分钟最多 5 次 ──
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: "每分钟我们只能交谈5次哦~" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── 静态文件 ──
app.use(express.static(__dirname));

// ── AI 聊天 API ──
/**
 * POST /api/chat
 * Body: { "message": "你好" }
 * 返回: { "reply": "AI的回复", "historyLength": 对话轮次 }
 */
app.post("/api/chat", chatLimiter, async function (req, res) {
  try {
    var message = req.body.message;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "请提供有效的消息内容" });
    }
    if (message.length > 300) {
      return res.status(400).json({ error: "消息内容不能超过300字哦~" });
    }

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