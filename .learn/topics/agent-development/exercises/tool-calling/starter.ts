/**
 * tool-calling 练习 — 🟡 Intermediate
 * 打开 README.md 看完整要求；用 tool-calling.test.ts 验收（TDD：测试即规格）。
 * 运行：cd 本目录 && npx vitest run
 */

// ─── 协议类型（OpenAI 兼容格式的最小子集）─────────────────────────

/** 模型输出的一次"调用意图"——注意模型只输出这个 JSON，不执行任何东西 */
export interface ToolCall {
  id: string;                // 唯一 id；回传结果时必须原样带上
  function: {
    name: string;            // 模型想调用的工具名
    arguments: string;       // ⚠️ JSON 字符串，不是对象！需要 parse
  };
}

export type ChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string };

/** 工具定义：schema 三件套给模型看，run 是你写的本地实现 */
export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;   // JSON Schema（练习中不参与匹配，仅示意）
  run: (args: any) => unknown;
}

/** 工具注册表：name → 实现（类比 Vue 的 provide/inject 映射） */
export type ToolRegistry = Record<string, Tool>;

/** 模型的一轮响应（练习省略 finish_reason：tool_calls 为空 = 任务完成） */
export interface ModelResponse {
  content: string | null;
  tool_calls?: ToolCall[];
}

export interface ChatClient {
  create(messages: ChatMessage[]): Promise<ModelResponse>;
}

// ─── Mock 模型：按脚本逐轮吐出预设响应（无需真实 API key）───────────
// 这就是"模型侧"的全部真相：不管多聪明，模型每轮只是基于历史输出下一段 JSON。
// 看测试里的脚本编排你会发现：多轮调用、犯错后自我修正，全是脚本提前安排好的。

export function mockClient(script: ModelResponse[]): ChatClient & { requests: ChatMessage[][] } {
  const requests: ChatMessage[][] = [];
  let i = 0;
  return {
    requests,
    async create(messages) {
      requests.push(messages);
      const resp = script[i++];
      if (!resp) throw new Error("mock 脚本已耗尽：模型响应轮数多于脚本长度");
      return resp;
    },
  };
}

// ─── 你的三个 TODO 实现 ──────────────────────────────────────────────

/**
 * TODO 1: 安全解析模型输出的参数 JSON（讲解会 Q2 的教训：错误是观察，不是崩溃）
 * 成功 → { ok: true, args: 解析结果 }
 * 失败 → { ok: false, error: "…" }；error 文案要"可行动"且包含 "JSON" 字样（测试断言）
 */
export function parseToolArgs(raw: string): { ok: true; args: unknown } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(raw);
    return { ok: true, args: parsed };
  } catch (err) {
    return { ok: false, error: `参数JSON解析失败：${(err as Error).message}` };
  }
}

/**
 * TODO 2: 执行单次工具调用，永远返回字符串（成功结果 or 错误观察），绝不抛异常
 * 四个分支：
 *   a) 工具名不在 registry → 错误观察（顺便列出可用工具，帮模型自我修正）
 *   b) 参数 parse 失败   → 错误观察（复用 TODO 1 的 error）
 *   c) tool.run() 抛异常  → 错误观察（下游故障也是一种观察！）
 *   d) 成功     → JSON.stringify(tool.run(args))
 * 错误观察统一格式：JSON.stringify({ error: "…" })
 */
export function executeToolCall(registry: ToolRegistry, call: ToolCall): string {
  const fnName = call.function.name;
  // a) 工具不存在
  if (!registry[fnName]) {
    const available = Object.keys(registry).join(", ");
    return JSON.stringify({ error: `工具【${fnName}】不存在，可用工具列表：${available}` });
  }

  const parseResult = parseToolArgs(call.function.arguments);
  // b) JSON解析失败
  if (!parseResult.ok) {
    return JSON.stringify({ error: parseResult.error });
  }

  const tool = registry[fnName];
  try {
    // d) 正常执行
    const result = tool.run(parseResult.args);
    return JSON.stringify(result);
  } catch (err) {
    // c) 工具运行抛出异常
    return JSON.stringify({ error: `工具执行异常：${(err as Error).message}` });
  }
}

export interface AgentResult {
  answer: string;            // 模型最终的自然语言回答
  steps: number;             // 经历的请求轮数（每次 client.create 算一步）
  messages: ChatMessage[];   // 完整消息历史——模型"记忆"的唯一来源
}

/**
 * TODO 3: 主循环——把讲解会里的"单回合"升级成"多轮循环"（agent-loop 预告片）
 * 逻辑：
 *   1. messages 以 user 消息开始
 *   2. await client.create(messages)，响应转成 assistant 消息原样 push 进历史
 *   3. 响应没有 tool_calls（或为空数组）→ 任务完成，返回 { answer, steps, messages }
 *   4. 有 tool_calls → 逐个 executeToolCall，结果以 { role:"tool", tool_call_id: call.id, content } push
 *   5. 回到 2
 *   6. 循环 maxSteps 轮仍未完成 → throw new Error("…maxSteps…")（文案含 maxSteps 或"步数"，测试用正则匹配）
 */
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

    // 组装 assistant 消息并入历史
    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: resp.content,
      tool_calls: resp.tool_calls,
    };
    messages.push(assistantMsg);

    // 没有工具调用，任务结束
    if (!resp.tool_calls || resp.tool_calls.length === 0) {
      return {
        answer: resp.content ?? "",
        steps,
        messages,
      };
    }

    // 逐个执行工具调用，追加 tool 消息
    for (const call of resp.tool_calls) {
      const toolContent = executeToolCall(registry, call);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: toolContent,
      });
    }
  }

  // 超过最大步数限制
  throw new Error(`达到最大步数限制 maxSteps=${maxSteps}，agent 停止执行`);
}
