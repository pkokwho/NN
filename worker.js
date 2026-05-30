export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return corsResponse(new Response(null, { status: 204 }));
    }

    if (path === "/api/health" && request.method === "GET") {
      return corsResponse(handleHealth());
    }

    if (path === "/api/chat" && request.method === "POST") {
      const rateResult = rateLimit(request);
      if (!rateResult.ok) {
        return corsResponse(new Response(JSON.stringify({ error: "每分钟我们只能交谈5次哦~" }), {
          status: 429,
          headers: { "Content-Type": "application/json" }
        }));
      }
      return corsResponse(await handleChat(request, env));
    }

    return corsResponse(new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    }));
  }
};

function corsResponse(response) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  return response;
}

function handleHealth() {
  return new Response(JSON.stringify({ status: "ok", time: new Date().toISOString() }), {
    headers: { "Content-Type": "application/json" }
  });
}

var rateLimitMap = new Map();

function rateLimit(request) {
  var ip = request.headers.get("CF-Connecting-IP") || "unknown";
  var now = Date.now();
  var windowMs = 60 * 1000;
  var maxRequests = 5;

  var entry = rateLimitMap.get(ip);
  if (!entry || now > entry.reset) {
    entry = { count: 0, reset: now + windowMs };
    rateLimitMap.set(ip, entry);
  }
  entry.count++;
  if (entry.count > maxRequests) {
    return { ok: false };
  }
  return { ok: true };
}

var SYSTEM_PROMPT = "你是任年友个人网站的AI智能助手\"小友\"。你的主人是任年友。\n关于主人：\n- 热爱健身，坚持锻炼多年\n- 喜欢弹电子琴，正在不断学习进步中\n- 从事网页设计开发工作\n- 是一个在现实与数字之间游走、寻找生活温度的普通人\n\n你的风格：\n- 温暖、真诚、有礼貌\n- 回复简洁有温度，不要太长\n- 可以适当使用 emoji 但不要过度\n- 如果有人问隐私信息（电话、地址等），礼貌拒绝";

var chatHistory = [];

async function handleChat(request, env) {
  var body;
  try {
    body = await request.json();
  } catch (_) {
    return new Response(JSON.stringify({ error: "请求格式错误" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  var message = body.message;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return new Response(JSON.stringify({ error: "请提供有效的消息内容" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (message.length > 300) {
    return new Response(JSON.stringify({ error: "消息内容不能超过300字哦~" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  var apiKey = env.AI_CHAT_API_KEY;
  var apiUrl = env.AI_CHAT_API_URL || "https://api.deepseek.com/chat/completions";
  var model = env.AI_CHAT_MODEL || "deepseek-chat";

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "AI 服务未配置，请联系管理员" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  chatHistory.push({ role: "user", content: message.trim() });

  var messages = [{ role: "system", content: SYSTEM_PROMPT }];
  var historySlice = chatHistory.slice(-21, -1);
  for (var i = 0; i < historySlice.length; i++) {
    messages.push(historySlice[i]);
  }
  messages.push({ role: "user", content: message.trim() });

  try {
    var resp = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        max_tokens: 1024,
        temperature: 0.7
      })
    });

    if (!resp.ok) {
      chatHistory.pop();
      var errText = "";
      try { errText = await resp.text(); } catch (_) {}
      if (resp.status === 401) throw new Error("AI API 密钥无效");
      if (resp.status === 429) throw new Error("请求过于频繁，请稍后再试");
      throw new Error("AI 服务返回错误: " + resp.status);
    }

    var data = await resp.json();
    var reply = (data.choices && data.choices[0] && data.choices[0].message)
      ? data.choices[0].message.content
      : "";

    if (!reply) throw new Error("AI 未返回有效回复");

    chatHistory.push({ role: "assistant", content: reply });

    return new Response(JSON.stringify({ reply: reply, historyLength: chatHistory.length }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    chatHistory.pop();
    return new Response(JSON.stringify({ error: err.message || "服务器内部错误" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}