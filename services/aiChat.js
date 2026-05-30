const DOTENV_LOADED = (function initEnv() {
  try { require("dotenv").config(); return true; } catch (_) { return false; }
})();

const AI_API_KEY = process.env.AI_CHAT_API_KEY || "";
const AI_API_URL = process.env.AI_CHAT_API_URL || "https://api.solo.chat/v1/chat/completions";
const AI_MODEL = process.env.AI_CHAT_MODEL || "gpt-4o-mini";
const MAX_TOKENS = parseInt(process.env.AI_CHAT_MAX_TOKENS || "1024", 10);
const TIMEOUT_MS = parseInt(process.env.AI_CHAT_TIMEOUT_MS || "30000", 10);

const SYSTEM_PROMPT = `你是任年友个人网站的AI智能助手"小友"。你的主人是任年友。
关于主人：
- 热爱健身，坚持锻炼多年
- 喜欢弹电子琴，正在不断学习进步中
- 从事网页设计开发工作
- 是一个在现实与数字之间游走、寻找生活温度的普通人

你的风格：
- 温暖、真诚、有礼貌
- 回复简洁有温度，不要太长
- 可以适当使用 emoji 但不要过度
- 如果有人问隐私信息（电话、地址等），礼貌拒绝`;

let chatHistory = [];

function getHistory() {
  return chatHistory;
}

function clearHistory() {
  chatHistory = [];
}

function buildMessages(userMessage) {
  const messages = [{ role: "system", content: SYSTEM_PROMPT }];
  for (const entry of chatHistory.slice(-20)) {
    messages.push({ role: entry.role, content: entry.content });
  }
  messages.push({ role: "user", content: userMessage });
  return messages;
}

async function sendMessage(userMessage) {
  if (!AI_API_KEY) {
    throw new Error("AI API 密钥未配置，请检查 .env 文件");
  }

  if (!userMessage || typeof userMessage !== "string" || userMessage.trim().length === 0) {
    throw new Error("消息内容不能为空");
  }

  if (userMessage.length > 2000) {
    throw new Error("消息内容过长，请限制在2000字以内");
  }

  chatHistory.push({ role: "user", content: userMessage.trim() });

  const messages = buildMessages(userMessage);
  const controller = new AbortController();
  const timeoutId = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);

  try {
    const response = await fetch(AI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + AI_API_KEY
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: messages,
        max_tokens: MAX_TOKENS,
        temperature: 0.7
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errText = await response.text().catch(function () { return ""; });
      if (response.status === 401) throw new Error("AI API 密钥无效");
      if (response.status === 429) throw new Error("请求过于频繁，请稍后再试");
      throw new Error("AI 服务返回错误: " + response.status + (errText ? " - " + errText.slice(0, 200) : ""));
    }

    const data = await response.json();
    const reply = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : "";

    if (!reply) throw new Error("AI 未返回有效回复");

    chatHistory.push({ role: "assistant", content: reply });
    return { reply: reply, historyLength: chatHistory.length };

  } catch (err) {
    chatHistory.pop();
    if (err.name === "AbortError") throw new Error("请求超时，请稍后重试");
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = {
  sendMessage: sendMessage,
  getHistory: getHistory,
  clearHistory: clearHistory
};