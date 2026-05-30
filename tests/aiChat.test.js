require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const aiChat = require("../services/aiChat");

var passed = 0;
var failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log("  ✓ " + label);
    passed++;
  } else {
    console.error("  ✗ " + label);
    failed++;
  }
}

function assertRejects(promise, label) {
  return promise.then(
    function () { console.error("  ✗ " + label + " (应抛出错误但未抛出)"); failed++; },
    function () { console.log("  ✓ " + label + " (正确抛出错误)"); passed++; }
  );
}

async function run() {
  console.log("\n=== AI 聊天服务测试 ===\n");

  // 1. 模块加载
  console.log("[模块加载]");
  assert(typeof aiChat === "object", "aiChat 模块正确导出为对象");
  assert(typeof aiChat.sendMessage === "function", "sendMessage 是函数");
  assert(typeof aiChat.getHistory === "function", "getHistory 是函数");
  assert(typeof aiChat.clearHistory === "function", "clearHistory 是函数");

  // 2. 空消息
  console.log("\n[输入校验 - 空消息]");
  await assertRejects(aiChat.sendMessage(""), "空字符串应被拒绝");
  await assertRejects(aiChat.sendMessage("   "), "纯空格应被拒绝");
  await assertRejects(aiChat.sendMessage(null), "null 应被拒绝");
  await assertRejects(aiChat.sendMessage(undefined), "undefined 应被拒绝");

  // 3. 超长消息
  console.log("\n[输入校验 - 超长消息]");
  await assertRejects(
    aiChat.sendMessage("a".repeat(2001)),
    "超过2000字应被拒绝"
  );

  // 4. 历史记录
  console.log("\n[历史记录管理]");
  aiChat.clearHistory();
  var h1 = aiChat.getHistory();
  assert(Array.isArray(h1) && h1.length === 0, "clearHistory 后历史为空");

  // 5. API 密钥存在性检查
  console.log("\n[安全 - API密钥保护]");
  var hasKey = !!process.env.AI_CHAT_API_KEY;
  assert(hasKey, ".env 中 AI_CHAT_API_KEY 已配置");
  assert(
    process.env.AI_CHAT_API_KEY.indexOf("apisk-") === 0,
    "API 密钥格式以 apisk- 开头"
  );

  // 6. 实际 API 调用
  if (hasKey) {
    console.log("\n[实际 API 调用]");
    try {
      var result = await aiChat.sendMessage("你好，请用一句话介绍你自己");
      assert(typeof result.reply === "string" && result.reply.length > 0, "AI 返回非空回复");
      assert(result.historyLength >= 2, "历史记录包含用户和AI消息");
      console.log("  AI 回复: " + result.reply.slice(0, 80) + (result.reply.length > 80 ? "..." : ""));
    } catch (e) {
      console.error("  ✗ API 调用失败: " + e.message);
      failed++;
    }

    // 7. 多轮对话
    console.log("\n[多轮对话]");
    var hBefore = aiChat.getHistory().length;
    var r2 = await aiChat.sendMessage("我主人是谁？").catch(function () { return null; });
    var hAfter = aiChat.getHistory().length;
    assert(hAfter > hBefore, "多轮对话后历史记录增长");
    if (r2) console.log("  AI 回复: " + r2.reply.slice(0, 80) + (r2.reply.length > 80 ? "..." : ""));
  } else {
    console.log("\n[实际 API 调用] 跳过 - 需配置 API 密钥");
  }

  // 结果
  console.log("\n=== 测试结果: " + passed + " 通过, " + failed + " 失败 ===\n");
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(function (e) {
  console.error("测试异常: " + e.message);
  process.exit(1);
});