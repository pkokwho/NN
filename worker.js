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

    if (path === "/api/chat/history" && request.method === "GET") {
      return corsResponse(jsonResponse({ history: [] }));
    }

    if (path === "/api/chat/history" && request.method === "DELETE") {
      return corsResponse(jsonResponse({ ok: true }));
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
  response.headers.set("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS");
  return response;
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
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

var SYSTEM_PROMPT = "你是任年友个人网站里的 AI 助手。\n你的性格幽默、搞笑、有梗，但不是胡闹。\n你可以适当用轻松、有趣、像朋友一样的语气回答，让用户感觉聊天不无聊。\n但是当用户问学习、技术、健身、项目、人生建议等正式问题时，你必须认真、专业、清楚、有逻辑地回答。\n你可以偶尔开小玩笑，但不能影响答案质量。\n你擅长帮助用户学习、了解网站内容、制定学习计划、制定健身计划、解答基础前端和 AI 工具问题。\n你的回答要适合新手理解，不要故意说复杂。\n不要说自己是 DeepSeek。\n当用户问你是谁时，你应该回答：\n“我是任年友个人网站里的 AI 助手，主打一个幽默陪聊 + 正经办事。你可以找我聊天、学习、做计划，也可以让我帮你解决一些小问题。”";

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
  var model = env.AI_CHAT_MODEL || "deepseek-v4-flash";

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "AI 服务未配置，请联系管理员" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  var messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: message.trim() }
  ];

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

    return new Response(JSON.stringify({ reply: reply, historyLength: 2 }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "服务器内部错误" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
