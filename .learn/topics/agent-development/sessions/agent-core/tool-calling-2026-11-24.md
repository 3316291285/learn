# 讲解会话：Tool Calling 工具调用（agent-core · tool-calling）

> 日期：2026-11-24 · 阶段 1 第 1 个概念 · 讲解对象：Vue3+TS 前端开发者，有 Dify 工作流编排经验

---

## 一、定位：它是什么，为什么是基石

**Tool Calling = 让 LLM 从"只会说话"升级为"能点菜"的机制。**

- 没有工具的 LLM：你问它"北京今天多少度"，它只能靠训练数据瞎猜或说"我无法获取实时信息"。
- 有工具的 LLM：它在回答前可以输出一段**结构化请求**——"请帮我执行 `get_weather(city=北京)`，拿到结果我再回答"。

在整个知识图谱中的位置：

```
llm-api（会调 API）
   └─ tool-calling（模型能"点名"你的函数）★ 你在这里
         └─ agent-loop（把一次点名变成 while 循环）
               └─ agent-memory / multi-agent / mcp（都建立在工具之上）
```

一句话记住：**tool-calling 是原子操作，agent-loop 是它的 while 循环包装**。DSH 里每一个 Tool 插件、Dify 里每一个工具节点，底层都是这个机制。

## 二、核心机制：一次完整的四步回合

关键认知先立住：**模型从头到尾没有执行任何代码**。它只做一件事——输出 JSON 说"我想调用哪个函数、参数是什么"。执行 100% 发生在你的客户端。整个回合是：

```
① 你发请求（带工具清单） → ② 模型回 tool_calls（只是意图，不是结果）
→ ③ 你的代码本地执行     → ④ 把结果 append 回 messages，再调一次 API
```

对应到 API 报文（OpenAI 兼容格式，DeepSeek 同样适用）：

**第 1 步 — 请求里带工具清单**（JSON Schema 就是给模型看的函数说明书）：

```json
{
  "type": "function",
  "function": {
    "name": "get_weather",
    "description": "查询指定城市当前天气",
    "parameters": {
      "type": "object",
      "properties": { "city": { "type": "string" } },
      "required": ["city"]
    }
  }
}
```

**第 2 步 — 模型返回 `finish_reason: "tool_calls"`**，消息长这样：

```json
{
  "role": "assistant",
  "content": null,
  "tool_calls": [{
    "id": "call_abc123",
    "type": "function",
    "function": { "name": "get_weather", "arguments": "{\"city\": \"北京\"}" }
  }]
}
```

**第 3 步 — 你本地执行**（模型点名的函数，实现必须你自己写）。

**第 4 步 — 结果以 `role: "tool"` 消息回传**，再请求一次：

```json
{ "role": "tool", "tool_call_id": "call_abc123", "content": "{\"temp\": 22}" }
```

注意两个协议细节：
- `arguments` 是 **JSON 字符串**，不是对象——必须 `JSON.parse`，也可能 parse 失败。
- 回传结果必须带 `tool_call_id` 与上面的 `id` 对应，缺了会 400 报错。

## 三、类比锚点

**对 Dify（你用过）**：你在 Dify 里拖一个"工具节点"，平台帮你做的事就是这四步——LLM 节点输出意图 → 平台解析 → 执行工具 → 结果喂回下一个节点。**区别在于**：Dify 工作流的调用路径是你画死在画布上的（静态图）；而 agent 用 tool-calling 时，**调哪个工具、调几次、何时停，是模型运行时自己决定的**（动态）。这就是"工作流"和"智能体"的分界线。

**对前端（Vue3/TS）**：
- 工具 schema ≈ 组件的 **props 类型定义**——`description` 就是给模型看的文档注释，写得越清楚模型选得越准。
- 工具注册表（name → 实现）≈ **provide/inject 或组件注册表**——名字到函数的映射。
- `finish_reason: "tool_calls"` ≈ 一个 **pending 状态的 Promise**——模型在说"我等着你的执行结果才能继续"。
- 整个回合 ≈ **事件机制**：模型 emit 一个 `tool_call` 事件，你监听、执行 handler、把结果 emit 回去。

## 四、代码示例：手写一次完整回合（TypeScript + DeepSeek）

```typescript
// 依赖：pnpm add openai   （DeepSeek 官方推荐用 OpenAI SDK 改 baseURL）
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY,
});

// ① 工具清单：schema 写得越明白，模型选得越准
const tools = [{
  type: "function",
  function: {
    name: "get_weather",
    description: "查询指定城市当前天气，回答穿衣/出行问题前应先调用",
    parameters: {
      type: "object",
      properties: { city: { type: "string", description: "城市名，如：北京" } },
      required: ["city"],
    },
  },
}];

// ② 本地实现：模型只会点名，干活的是你的代码
function get_weather(args: { city: string }) {
  return { city: args.city, temp: 22, condition: "多云" }; // 示例 mock
}

const messages: OpenAI.ChatCompletionMessageParam[] = [
  { role: "user", content: "北京今天适合穿什么？" },
];

// ③ 第一次请求：模型决定"我要用工具"
const r1 = await client.chat.completions.create({
  model: "deepseek-chat", messages, tools,
});
const msg = r1.choices[0].message;
messages.push(msg); // ⚠️ assistant 的 tool_calls 消息必须原样放回历史

if (msg.tool_calls) {
  for (const call of msg.tool_calls) {              // 一个回合可能并行多个调用
    const args = JSON.parse(call.function.arguments); // ⚠️ 是字符串，且可能非法
    const result = get_weather(args);                // ④ 本地执行
    messages.push({
      role: "tool",
      tool_call_id: call.id,                         // ⚠️ 必须与 id 对应
      content: JSON.stringify(result),
    });
  }
}

// ⑥ 第二次请求：模型拿到观察，生成自然语言回答
const r2 = await client.chat.completions.create({
  model: "deepseek-chat", messages, tools,
});
console.log(r2.choices[0].message.content);
// → "北京今天 22°C 多云，建议薄外套……"
```

跑通这段 = 你已经手写了 agent 的"一次心跳"。DSH 平台里每次模型说"我要用某个 Tool"，底层跑的就是这套报文交换。

## 五、常见误区

1. **"模型执行了工具"** —— 错。模型只输出 JSON 意图，执行永远在你的进程里。模型是大脑 issuing 订单，你的代码是手脚。
2. **"arguments 是对象"** —— 它是 JSON 字符串，要 parse；模型可能输出非法 JSON（长参数被截断时高发），生产代码要 try/catch 并把错误信息作为 tool 结果回传给模型让它重试。
3. **"执行完结果模型自然知道"** —— 模型是无状态的！不把结果 append 进 messages 再调一次 API，模型永远看不到执行结果。所谓"记忆"全靠你回放消息历史。
4. **"tool_call_id 可省"** —— 缺了或不对应直接 400。
5. **"一个回合只有一个工具调用"** —— 模型可能一次返回多个 tool_calls（并行），要逐个执行、逐条回传。
6. **"工具越多越强"** —— 工具定义全量占 token 且稀释模型的选择准确率；工具多时要靠 MCP/分组/检索收敛（后面 mcp 概念会讲）。

## 六、苏格拉底式自检（先自己想，再看我的回应）

**Q1：如果第二次请求后，模型返回的消息里又带了 `tool_calls`，说明什么？代码该怎么改？**

想：模型查完天气后可能说"还得查一下穿衣指南"——说明任务没完成，需要**再来一轮**。当前代码只处理一轮，要改成一个循环：`while (msg.tool_calls) { 执行、回传、再请求 }`。这个循环，就是下一个概念 **agent-loop** 的全部秘密。

**Q2：`JSON.parse(call.function.arguments)` 抛异常了怎么办？**

想：不能让整个程序崩。正确姿势是 catch 住，把错误文本作为 `role: "tool"` 结果回传（如 `{"error": "arguments 不是合法 JSON: ..."}`），模型下一轮看到错误会自己修正参数重试。**工具错误不是程序异常，是给模型的一种观察反馈**——这个视角转变很关键。

**Q3：把 description 全删了，模型会怎样？**

想：模型选择工具全靠 schema 文本做语义匹配。没有 description，模型只能靠函数名猜，多工具场景下会选错、乱传参。所以工具设计的一半功夫在"写文档"——这正是从 tool-calling 通向 prompt-engineering 的桥。

## 七、递归入口（选一个方向深挖）

- **A. 协议细节流**：`tool_calls` 消息协议 → 并行调用 / 错误回传 / 流式下的 tool_calls 累积（`node-async-stream` 域会接上 SSE）
- **B. 设计流**：tool schema 设计原则 → description 工程 → 接 `structured-output`（tool calling 本质是一种结构化输出）
- **C. 纵深流**：直接进入 **agent-loop**（把今天的单回合改成 while 循环，就是完整的最小 agent）——这是主线推荐

## 讲解小结

- 模型不执行任何东西，它只输出"我想调用 X(参数 Y)"的 JSON；执行与结果回传全是你的客户端责任。
- 四步回合：带清单请求 → 收 tool_calls → 本地执行 → `role:"tool"` 回传再请求。
- Dify 工具节点 = 平台替你做了这四步，但路径画死；agent 的路径由模型运行时决定。
- 一个回合 ≠ 任务完成；循环起来才是 agent（下一站 agent-loop）。

---

## 苏格拉底问答记录（学习者首次作答 · 2026-11-24）

**总体理解复述**：学习者正确复述了四步回合的核心（无工具→靠训练数据答、有幻觉风险；接入工具→模型输出意图 JSON→本地执行→结果回传）。两处需精化：① 工具的首要目的是补"实时/私有数据 + 动作能力"，幻觉减少是接地（grounding）的副产品；② 整理成 JSON 给模型的是工具说明书（schema），不是用户需求——模型反向输出参数 JSON。

**Q1（又见 tool_calls 说明什么）——答偏，已纠偏**：
- 学习者答：认为模型产生误解/幻觉，需调整 tool 的 result。
- 正解：新一轮 tool_calls 是**最正常的情形**——任务需要多步（如查完天气再查穿衣建议）。判别方法：看新调用的参数是否**依赖上一轮结果**（依赖=正常多步；相同参数反复=卡死异常）。处理方式是**循环执行直到模型不再要求工具**，这正是 agent-loop 的定义。
- 纠偏要点：**"模型主动再 call"≠ 异常信号；它恰恰是 agent 有价值的证据**。

**Q2（JSON.parse 抛异常怎么办）——半对**：
- 学习者答：区分了 schema 结构出错 vs 模型幻觉两种成因（诊断意识好）；提出重新请求或停下检查 schema。
- 正解补充运行时标准手法：try/catch 后**把错误文本作为 role:"tool" 结果回传**，模型下一轮自行修正参数。"错误即观察反馈，不是程序崩溃"。停下检查 schema 是开发期手段，运行期应闭环自愈。

**Q3（删光 description 会怎样）——全对** ✅：
- 学习者答：模型难以定位该工具、可能误调其他工具、可能退回训练数据自己生成。完全正确。
- 补充：模型选工具 = 用户 query 与 name/description/参数描述的语义匹配；description 就是工具维度的 prompt engineering。

**置信度调整**：0.3 → 0.4（机制复述正确、Q3 全对；Q1 的"多步=异常"误判是主要缺口，已纠偏，待 practice 验证）。

---

## 追问澄清（2026-11-24 第二轮问答）

**追问 1：多轮调用是同一个工具还是换工具？**
- 澄清：三种都可能——同工具换参数（翻页 page=1→2）、换成另一个工具（get_weather→get_clothing_advice）、不再调用直接回答。模型**每轮基于全量消息历史重新决策**，"边"是运行时画出来的（对比 Dify 静态连线）。

**追问 2：Q2 核心 = catch 后格式化错误、按正常通道回传、决策权交还模型？**
- 学习者复述**正确** ✅。补充两个深化点：① API 层面没有"错误专用消息类型"，错误就是 content 里的普通文本，模型根本不知道"这是错误"；② 错误信息要写得**可行动**（指出哪里错、怎么改），错误消息质量直接影响模型自愈成功率——错误文案也是 prompt engineering。
- 置信度维持 0.4（复述正确但尚未独立应用，practice 验证后再调）。
