# 练习：实现 Tool Calling 协议执行器 🟡 Intermediate

> 主题：agent-development · 概念：`tool-calling` · 前置：已完成讲解（2026-11-24 会话）

## 🎯 目标

不调真实 API（无需 key），通过驱动一个 **mock 模型**，亲手实现 tool calling 的**客户端协议逻辑**——也就是 Dify 平台"工具节点"、DSH 平台 Tool 系统在你看不见的地方干的事：

1. 安全解析模型输出的参数 JSON（`arguments` 是字符串，会非法）
2. 执行单次工具调用——**任何失败都变成"错误观察"回传，而不是崩溃**
3. 多轮主循环：模型反复要工具 → 反复执行回传 → 直到它不再要（或熔断）

## 📖 背景（对应讲解会的三个关键认知）

| 认知 | 对应测试场景 |
|---|---|
| 模型不执行任何东西，只输出意图 JSON | 全部场景（mock 脚本就是"模型的判断"） |
| 再次 tool_calls = 多步任务的**正常情形** | 场景 2（天气结果喂给穿衣建议） |
| 错误即观察：失败格式化后走正常通道回传，模型自行修正 | 场景 3、4（非法 JSON / 不存在的工具） |

## ✅ 任务清单（TDD：先跑测试看全红，再实现变绿）

编辑 [starter.ts](starter.ts) 中三个 `TODO` 函数（类型定义和 mock 模型已给好，**不要改测试文件**）：

- [ ] **TODO 1** `parseToolArgs(raw)` — 安全 JSON 解析。成功 → `{ ok: true, args }`；失败 → `{ ok: false, error }`，error 文案需包含 `"JSON"` 字样且"可行动"（指出该重试）
- [ ] **TODO 2** `executeToolCall(registry, call)` — 四个分支：未知工具名 / 参数非法 / run 抛异常 / 成功。**任何分支都返回字符串**，错误用 `JSON.stringify({ error: "..." })`
- [ ] **TODO 3** `runAgent(client, registry, userMessage, maxSteps)` — 主循环：请求 → 无 tool_calls 则返回；有则逐个执行、以 `role:"tool"` + `tool_call_id` 回传 → 再请求。超过 `maxSteps` 抛 `Error`（文案含"步数"或"maxSteps"）

## ▶️ 运行测试

```bash
cd .learn/topics/agent-development/exercises/tool-calling
npx vitest run          # 或 npx vitest（进入 watch 模式，改完自动重跑）
```

**验收标准**：11 个测试全绿。

## 💡 提示（卡住了再看）

<details>
<summary>提示 1：executeToolCall 的骨架</summary>

```typescript
export function executeToolCall(registry: ToolRegistry, call: ToolCall): string {
  const tool = registry[call.function.name];
  if (!tool) return JSON.stringify({ error: `未知工具 "${call.function.name}"，可用工具：${Object.keys(registry).join(", ")}` });
  const parsed = parseToolArgs(call.function.arguments);
  if (!parsed.ok) return JSON.stringify({ error: parsed.error });
  try { return JSON.stringify(tool.run(parsed.args)); }
  catch (e) { return JSON.stringify({ error: `工具执行失败: ${(e as Error).message}，请修正后重试` }); }
}
```
</details>

<details>
<summary>提示 2：runAgent 循环骨架</summary>

```typescript
const messages: ChatMessage[] = [{ role: "user", content: userMessage }];
for (let step = 1; step <= maxSteps; step++) {
  const resp = await client.create(messages);
  messages.push({ role: "assistant", content: resp.content, tool_calls: resp.tool_calls });
  if (!resp.tool_calls?.length) return { answer: resp.content ?? "", steps: step, messages };
  for (const call of resp.tool_calls) {
    messages.push({ role: "tool", tool_call_id: call.id, content: executeToolCall(registry, call) });
  }
}
throw new Error(`超过最大步数限制 maxSteps=${maxSteps}，模型可能在死循环`);
```
</details>

<details>
<summary>提示 3：为什么要 maxSteps 熔断？</summary>

真实场景中模型可能用相同参数无限重试（每轮都烧 token）。这是下一个概念 `agent-loop` 的"终止条件"预演——现在只需知道：循环必须有刹车。
</details>

## 🔗 关联概念

- 下一站：`agent-loop`（今天 TODO 3 的循环，就是它的主体）
- 远期：`harness-tool`（DSH 里 Tool 插件 = 这里的 ToolRegistry 注册项 + 权限边界）

## 📊 你的讲解会问答记录（练习时对照）

- Q1 曾误判"再次 tool_calls = 异常"→ 本练习场景 2 会验证正确理解
- Q2 复述过"catch 后格式化回传"→ TODO 1/2 就是把它写成代码
