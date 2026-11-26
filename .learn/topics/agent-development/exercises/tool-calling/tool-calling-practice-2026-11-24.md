# Practice Session - 2026-11-24

## Concept Practiced
- Concept: Tool Calling 工具调用（tool-calling） | Difficulty: 🟡 Intermediate | Exercise: 实现 Tool Calling 协议执行器
- 结果：**11/11 测试一次全绿**

## User's Submitted Code
（完整文件见 [starter.ts](starter.ts)，此处记录三个核心实现）

```typescript
export function parseToolArgs(raw: string): { ok: true; args: unknown } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(raw);
    return { ok: true, args: parsed };
  } catch (err) {
    return { ok: false, error: `参数JSON解析失败：${(err as Error).message}` };
  }
}

export function executeToolCall(registry: ToolRegistry, call: ToolCall): string {
  const fnName = call.function.name;
  if (!registry[fnName]) {
    const available = Object.keys(registry).join(", ");
    return JSON.stringify({ error: `工具【${fnName}】不存在，可用工具列表：${available}` });
  }
  const parseResult = parseToolArgs(call.function.arguments);
  if (!parseResult.ok) {
    return JSON.stringify({ error: parseResult.error });
  }
  const tool = registry[fnName];
  try {
    const result = tool.run(parseResult.args);
    return JSON.stringify(result);
  } catch (err) {
    return JSON.stringify({ error: `工具执行异常：${(err as Error).message}` });
  }
}

export async function runAgent(
  client: ChatClient,
  registry: ToolRegistry,
  userMessage: string,
  maxSteps = 8,
): Promise<AgentResult> {
  const messages: ChatMessage[] = [{ role: "user", content: userMessage }];
  let steps = 0;
  while (steps < maxSteps) {
    steps += 1;
    const resp = await client.create(messages);
    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: resp.content,
      tool_calls: resp.tool_calls,
    };
    messages.push(assistantMsg);
    if (!resp.tool_calls || resp.tool_calls.length === 0) {
      return { answer: resp.content ?? "", steps, messages };
    }
    for (const call of resp.tool_calls) {
      const toolContent = executeToolCall(registry, call);
      messages.push({ role: "tool", tool_call_id: call.id, content: toolContent });
    }
  }
  throw new Error(`达到最大步数限制 maxSteps=${maxSteps}，agent 停止执行`);
}
```

## AI Feedback

### ✅ 做得好的
1. **11/11 测试一次全绿**——三个函数分支覆盖完整（未知工具 / 参数非法 / run 抛异常 / 成功；循环终止 / 回传 / 熔断），无遗漏。
2. **加分项**：未知工具的错误观察列出了可用工具列表（`可用工具列表：get_weather, get_clothing_advice`）——这正是"可行动错误"的最佳实践，模型拿到后能立即自我修正，超出任务最低要求。
3. **runAgent 结构清晰**：while + 步数计数、assistant 消息组装入历史、空 tool_calls 提前返回、逐个执行并按 `tool_call_id` 回传——与协议规范逐条对应。

### 🔍 两个可选质量点（不影响验收）
1. `executeToolCall` 中 `registry[fnName]` 取了两次（存在性判断 + 实际取值），可合并为一次 `const tool = registry[fnName]; if (!tool) {...}`。
2. 错误文案可再加"请修正参数后重试"类引导语，帮模型更快收敛（锦上添花）。

### 📚 对照讲解会问答的验证结论
- 场景 2（多轮不同工具）通过 → **Q1 的"多步=异常"误判已修正**：在代码里它就是 while 循环的正常路径。
- 场景 3/4（非法 JSON / 未知工具）通过 → **"错误即观察"已从概念落地为代码习惯**：所有失败都走 `role:"tool"` 正常通道返回，无一处抛异常打断回合。
- 场景 5（maxSteps 熔断）通过 → 提前实践了 agent-loop 的"终止条件"设计。

## Assessment
- Understanding: Solid（Strong：一次通过、分支完整、含最佳实践加分项）
- Status: in_progress → in_progress（原规则 mastered 需 confidence>0.7 且 practice≥2；因用户偏好调整——不做手写练习——晋级规则已改为 explain+quiz 达标即可，见 LEARNING-CONTEXT.md 第 6 节）
- Confidence: 0.4 → 0.55
