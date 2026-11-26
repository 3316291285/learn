# 讲解会话：Agent Loop 智能体循环（agent-core · agent-loop）

> 日期：2026-11-24 · 阶段 1 第 2 个概念 · 讲解对象：Vue3+TS 前端开发者，有 Dify 工作流经验；已讲透 tool-calling 并亲手实现过 `runAgent`
> 说明：按学习者偏好，本讲解以"读懂代码理解概念"为路径；第六节苏格拉底自检为开放式纯问答（保持原样），巩固环节（practice/quiz）采用选择/判断/问答题型

---

## 一、定位：它是什么，为什么是基石

**Agent Loop = 给 tool-calling 的"单回合"装上 while 循环和刹车。**

你在今天的练习里已经亲手写过它的雏形——`runAgent` 就是教科书级的 agent loop 最小实现。所以本讲解不用从零开始，而是把你写过的代码"翻译"成概念。

知识图谱位置：

```
tool-calling（单回合：请求→意图→执行→回传）
   └─ agent-loop（多回合循环 + 决策 + 终止条件）★ 你在这里
         └─ agent-memory（历史膨胀了怎么办）/ multi-agent / mcp / agent-evaluation
```

一句话记住：**tool-calling 是心脏的一次跳动，agent-loop 是让心脏持续跳动的循环系统 + 熔断器。**

## 二、核心机制：循环的三要素

把你的 `runAgent` 抽象一下，**任何** agent loop（不管 Claude Code、DSH 还是 Dify 的 Agent 节点）都由三样东西构成：

| 要素 | 是什么 | 你的 runAgent 对应 |
|---|---|---|
| **状态 State** | messages 数组——模型无状态，这是它每轮"记忆"的全部 | `const messages = [{ role: "user", ... }]` |
| **决策 Decider** | 模型每轮重读全量历史，二选一：要工具（继续循环）或给答案（退出循环） | `resp.tool_calls` 有无 |
| **刹车 Brakes** | 终止条件，分三类 | 你只实现了第一类 |
|   ① 正常终止 | 模型不再要工具 | ✓ `if (!resp.tool_calls?.length) return` |
|   ② 异常熔断 | maxSteps / 超时 / token 预算 / 重复调用检测 | 只做了 maxSteps |
|   ③ 外部中断 | 用户点"停止"——优雅收尾而非杀进程 | 未做 |

**ReAct 视角**（2022 年论文《ReAct: Synergizing Reasoning and Acting in Language Models》提出的经典模式）：每一轮的轨迹是 `Thought → Action → Observation`（思考 → 行动 → 观察）。现代 API 把 Thought **内化**了（模型内部推理，如 deepseek-reasoner 的思维链），协议层只能看到 Action（`tool_calls`）和 Observation（`role:"tool"` 消息）——但循环骨架从未变过。你在 Dify 里拖的 Agent 节点，内部跑的就是这个循环，只是它把"何时停"做成了画布上的节点参数。

### 成本模型（必懂，context-window 概念的伏笔）

N 步会话，每轮都要**重发全部历史**：第 1 轮发 1 份，第 2 轮发 2 份……总 token ≈ **O(N²)**。10 步会话 ≈ 单步历史的 55 倍（1+2+…+10）。这是 agent 比 chat 贵得多的根本原因，也是后面 agent-memory（压缩摘要）存在的理由。

## 三、类比锚点

**游戏主循环（最贴切）**：`while (running) { input → update → render }` vs `while (running) { 感知 → 决策 → 行动 }`。连"帧率上限"都对应 maxSteps——两者共享同一个软件结构。

**Vue3 响应式**：state（messages）变化 → "重新渲染"（模型重新决策）→ 可能触发副作用（tool call 改变 state）→ 循环，直到状态收敛不再变化（终止）。agent loop 本质上是一个"以模型为 reducer 的收敛循环"。

**Dify**：画布上的迭代/循环节点是**静态循环**（边界你事先画死）；agent loop 是**动态循环**（循环体固定为"问模型"，边界由模型行为决定）。这就是工作流与智能体的分界线在循环维度上的体现。

**DSH 关联**：harness 里的 agent 服务就是这个 loop 的宿主插件——你未来二开时写的 Tool 会被模型在循环中反复点名，而 loop 本身由平台提供。

## 四、代码示例：把你的 runAgent 升级为"生产雏形 V2"（阅读向）

在你写的基础上补三件事：**更全的刹车、重复调用检测、ReAct 轨迹记录**。示意代码（省略号处为琐碎收尾），建议对照你的 starter.ts 读：

```typescript
type StopReason = "completed" | "max_steps" | "loop_detected" | "timeout" | "interrupted";

interface AgentResultV2 {
  answer: string;
  steps: number;
  stopReason: StopReason;      // ← "为什么停"和"停了"一样重要：调试/计费/审计全靠它
  trace: { step: number; action: string; observation: string }[];  // ReAct 轨迹
}

export async function runAgentV2(
  client: ChatClient,
  registry: ToolRegistry,
  userMessage: string,
  opts: { maxSteps?: number; timeoutMs?: number; interrupt?: () => boolean } = {},
): Promise<AgentResultV2> {
  const { maxSteps = 12, timeoutMs = 120_000, interrupt } = opts;
  const deadline = Date.now() + timeoutMs;
  const messages: ChatMessage[] = [{ role: "user", content: userMessage }];
  const trace: AgentResultV2["trace"] = [];
  const signatures = new Map<string, number>();  // 刹车④：(工具名+参数) → 出现次数
  let steps = 0;

  while (steps < maxSteps) {
    if (Date.now() > deadline) return /* 刹车② timeout */;

    // 刹车③ 用户中断——优雅做法：把"停止"当作一条消息喂给模型，让它体面收尾
    if (interrupt?.()) {
      messages.push({ role: "user", content: "（系统提示：用户已请求停止，请总结当前进展并立即结束，勿再调用工具）" });
      const resp = await client.create(messages);
      return { answer: resp.content ?? "", steps, stopReason: "interrupted", trace };
    }

    const resp = await client.create(messages);
    steps++;
    messages.push({ role: "assistant", content: resp.content, tool_calls: resp.tool_calls });

    // 刹车① 正常终止
    if (!resp.tool_calls?.length) {
      return { answer: resp.content ?? "", steps, stopReason: "completed", trace };
    }

    for (const call of resp.tool_calls) {
      const sig = `${call.function.name}:${call.function.arguments}`;
      signatures.set(sig, (signatures.get(sig) ?? 0) + 1);
      const obs = executeToolCall(registry, call);
      trace.push({ step: steps, action: sig, observation: obs.slice(0, 200) });
      messages.push({ role: "tool", tool_call_id: call.id, content: obs });

      // 刹车④ 重复签名检测——抓 maxSteps 抓不住的"打转"（同参数调 3 次 = 死循环信号）
      if (signatures.get(sig)! >= 3) return /* loop_detected */;
    }
  }
  return /* 刹车② max_steps */;
}
```

三个升级点的设计意图：

1. **stopReason 显式化**：你原来的实现只知道"停了"，生产 agent 必须知道"为什么停"——这是调试的第一手证据。
2. **重复签名检测**：`maxSteps` 是钝刀（见误区 3），语义刹车能早停省钱。
3. **trace = ReAct 轨迹**：等价于 Dify 的运行日志面板，是 agent-evaluation 概念（轨迹回放调试）的物料。

（流式预告：真实平台里模型输出是流式的，`tool_calls` 的 `arguments` 是**分片到达**的字符串，需要增量拼接——这个细节属于 `node-async-stream` 概念，此处只需知道有这回事。）

## 五、常见误区

1. **"agent loop = while(true)"** —— 没有刹车的循环是烧钱核弹。终止条件不是实现细节，是设计核心；生产 agent 至少要有正常/熔断/中断三类刹车。
2. **"模型每轮只看上一轮结果"** —— 每轮重发**全量**历史。后果一：成本 O(N²)；后果二：历史里任何一次错误观察都会永久影响后续所有决策（脏历史难洗掉）。
3. **"maxSteps 能防住所有失控"** —— 它是钝刀：对"同参数无限重试"和"每轮换工具但永不收敛"都只能等步数烧满才停，且分不清"打转"和"慢工出细活"。所以才需要重复签名检测这类**语义刹车**。
4. **"中断 = 杀进程"** —— 优雅做法是把"用户请求停止"作为一条消息喂给模型，让它总结已完成进展后体面退出。已执行的工作不应被丢弃。
5. **"ReAct 必须显式输出 Thought"** —— 现代模型把推理内化了，协议层只见 tool_calls。模式没变，只是 Thought 从消息里挪进了模型内部。

## 六、苏格拉底自检（开放式纯问答）

**Q1（判断对错）**："一个 10 步的 agent 会话，总请求 token 约等于单轮平均请求的 10 倍左右，即总成本是 O(N)。"——这句话对吗？如果不对，正确结论是什么？

**Q2（场景分析）**：你的 `runAgent(maxSteps=8)` 面对下面两种失控分别会发生什么？
A. 模型用相同参数无限重试同一工具
B. 模型每轮换不同工具/微调参数，但任务永不收敛
以及：maxSteps 对两者的共同缺点是什么？

**Q3（设计题）**：用户在 agent 执行到第 4 步时点了"停止"按钮。在不杀进程的前提下，怎么让 agent 体面结束？已被执行的前 3 步成果如何处置？

## 七、递归入口（选一个方向深挖）

- **A. 安全与调试流**：终止条件设计 → 循环检测 → `agent-evaluation`（trace 轨迹回放正是调试 agent 的核心手段）
- **B. 记忆流**：历史膨胀问题 → `agent-memory`（压缩摘要）+ `context-window`（裁剪策略）——V2 里 messages 无限增长就是它们的引子
- **C. 主线纵深**：按图谱顺序进入 `agent-memory`（紧邻的下一个概念）

## 讲解小结

- agent loop = 状态（messages）+ 决策者（模型）+ 刹车（终止条件）；你的 runAgent 已是 1.0 版，V2 补齐了刹车矩阵和轨迹。
- ReAct 骨架：Thought（内化）→ Action（tool_calls）→ Observation（role:tool），每轮全量重放历史。
- 成本 O(N²) 是 agent 与 chat 的本质差异，直接催生"记忆压缩"需求。
- 生产级 loop 的灵魂是 stopReason 显式化——"为什么停"和"停了"同样重要。

---

## 苏格拉底问答记录（学习者作答 · 2026-11-24）

**Q1（成本 O(N) 判断题）——方向对，量化未完成**：
- 学习者答：不对，上下文是累加的。✅ 机制判断正确。
- 补完量化：正因为累加——第 1 轮发 1 份、第 2 轮发 2 份……总量 = 1+2+…+N = N(N+1)/2，即 **O(N²)**；N=10 时是单轮的 **55 倍**而非 10 倍。关键一步：把"累加"翻译成求和公式。

**Q2（maxSteps 对 A/B 的行为）——超预期，自主发现序列循环盲区**：
- 学习者答：A 被同参数三次检测终止；并指出可能存在 A→B→C→A 的循环形式，单签名计数抓不住；B 是合法的参数微调迭代，可能被机制误杀。
- 评价：完全正确，且 A→B→C→A 盲区正是递归入口 A 要解决的核心问题（见下文手段①滑动窗口）；"B 被误杀"点中了刹车设计的根本权衡：**误杀（false positive）vs 漏停（false negative）**。
- 补充"共同缺点"显式表述：maxSteps 只数步数不做语义判断——对 A 晚停（烧满预算才停）、对 B 误杀，钝刀。

**Q3（优雅中断设计）——正确**：
- 学习者答：用字段判断用户中断；中断后把上下文传给模型总结当前进度成果。✅ 与 V2 设计一致（interrupt 标志 + 注入系统消息 + stopReason="interrupted"）。

**置信度**：0.3 → 0.4（三题全对或方向正确，Q2 展现超出讲解范围的推理）。

---

## 递归入口 A：安全与调试流（终止条件设计 → 循环检测 → agent-evaluation 桥接）

### A-1 生产级刹车清单（7 种互补）

| 刹车 | 抓什么 | 漏什么 / 代价 |
|---|---|---|
| completed | 正常终止 | — |
| max_steps | 一切超步数行为（兜底） | 钝刀：晚停 + 误杀 |
| timeout | 慢、卡（网络挂起等） | 快速打转抓不住 |
| token_budget | 成本失控（比步数更贴钱） | 不限制轮次语义 |
| loop_detected（单签名） | 同名同参重复 | 换花样（A→B→C）抓不住 |
| 序列循环检测（窗口） | 周期性换花样 | 更长周期要更大窗口 |
| interrupted | 用户中断 | — |

设计原则：**多刹车互补、各自便宜**；让单一刹车既当裁判又当运动员必然漏。

### A-2 循环检测进阶（回应学习者发现的 A→B→C→A 盲区）

**① 滑动窗口序列检测**——把"最近 K 步的签名序列"作为整体比对：

```typescript
// 抓 A→B→C→A→B→C：最近一个窗口 == 前一个窗口 → 判定循环
function detectCycle(sigs: string[], window = 3, repeats = 2): boolean {
  if (sigs.length < window * repeats) return false;
  const last = sigs.slice(-window).join("|");
  const prev = sigs.slice(-window * repeats, -window).join("|");
  return last === prev;
}
```

**② 观察去重**——参数在变但返回值相同（世界没变）也是打转：对工具**结果**做哈希计数，而非只看参数。
**③ 进度启发**——检测"新信息增量"：新观察与历史观察高度相似 → 无进展。
**④ 自省式刹车**——把统计喂回模型："你已调用 X 3 次且结果相同，请换策略或直接总结"（软刹车；LangGraph 等框架常用）。
**⑤ 软硬两级**——第一次检出循环 → 注入警告（软刹车，给模型自纠机会）；再次检出 → 硬终止（保住部分成果 + 记录 stopReason）。这是解决"B 被误杀"的正解：**不是让检测更灵敏，而是给一次申诉机会**。

### A-3 桥接 agent-evaluation

练习里的 **mockClient 脚本 = 可复现轨迹**，场景 1–5 = 评估用例——学习者已经无意中做过 agent-evaluation 的事。正式版会讲：评估集设计、LLM-as-judge、轨迹评分。Dify 的运行日志面板 = trace 的 UI 化。调试 agent 的标准动作：**出问题时拿 trace 重放，定位是哪一轮的决策跑偏**。

### 入口 A 小检（读码判断 × 2，开放式问答作答）

**检 1**：`sigs = [A, B, A, B, A, B]`（AB 交替循环），调用 `detectCycle(sigs, window=3, repeats=2)`——会触发循环判定吗？为什么？这暴露了窗口检测的什么参数敏感性？

**检 2（单选）**：软刹车注入警告后，模型仍在打转，下一步应该：
a) 再注入一次更强的警告，继续观察
b) 硬终止，返回部分成果 + stopReason=loop_detected
哪个符合 stopReason 设计原则？为什么？

## 入口 A 小检批改（2026-11-24）

**检 1 ✅ 正确**：不会触发。length=6 恰好满足 2×3 的门槛，但 last 窗口 = [A,B,A]，前窗口 = [B,A,B]，错相位不相等 → 不判定。学习者点出"完全依赖 window/repeat 设定"——精确化：**窗口大小必须与循环周期对齐**。AB 交替是周期 2 的循环，window=3 与之错相位永远配不上；window=2 才能抓住（或多个候选窗口逐个尝试）。教训：窗口是按"最短可疑周期"选的参数，不是拍脑袋的常数。

**检 2 ✅ 正确 + 加分**：选 b，理由完整——一次自纠机会已给、继续循环浪费上下文 token、拿当前成果和循环原因报告用户、由用户调整方向；"完全依靠模型大概率不断循环"正是软刹车不能无限递归的原因。加分点：学习者主动补上了"升级给用户"这一层——生产 agent 的循环问题最终上报用户是标准做法（人是最外层刹车）。

**入口 A 闭环** ✅。**置信度**：0.4 → 0.5。

---

## 递归入口 B：记忆流（历史膨胀 → agent-memory + context-window 引子）

### B-1 问题起源：你的 V2 里 messages 无限增长

三个后果：**成本 O(N²)**（Q1 已量化）→ **窗口溢出**（超过模型上限后截断/报错，早期信息丢失）→ **脏历史污染**（一次错误观察永久影响后续所有决策）。这就是"记忆"要解决的问题。

### B-2 关键澄清：窗口 ≠ 记忆

- **上下文窗口**：模型单次能处理的 token 上限（如 deepseek-chat 128K）。窗口是"工作台大小"，不是记忆容量。
- **模型无状态**：跨请求的记忆 100% 来自你每轮重发的 messages。所谓"agent 的记忆"，全是你管理的。

### B-3 分层记忆模型（对照操作系统：内存 vs 磁盘）

| 层 | 是什么 | 类比 |
|---|---|---|
| 短期记忆 | messages 全量历史（工作集） | 内存 |
| 长期记忆 | 外部存储：文件/数据库/向量库，按需检索注入 | 磁盘 + 按需换页 |

### B-4 管理短期记忆的三大策略（都发生在循环内、下一次请求前）

1. **截断 truncation**：保留 system + 最近 N 轮，丢弃中间。便宜、丢细节。Dify 的"会话记忆窗口数"配置就是它。
2. **压缩 summarization**：把早期历史摘要成一条 summary 消息。保大意丢细节。**Claude Code 的 /compact 就是这个**。
3. **检索 retrieval**：历史入向量库，按当前需求检索相关片段注入。最贵最聪明（RAG 式）。

接入点在 loop 里就是一行：`messages = maybeCompress(messages)`——记忆管理是 agent-loop 的一个钩子，不是一个独立系统。

### B-5 数字感受

工具定义每次请求全量携带（之前讲过），一次 tool call 回合约几百到几千 token；50 步的 agent 不做管理，很容易逼近小模型的窗口上限。计费细节（tokenizer、输入/输出差价）留给 `context-window` 概念正式讲。

### 入口 B 小检（判断/场景 × 2）

**检 3（归类）**：Claude Code 的 `/compact` 属于三大策略中的哪一种？它"保什么、丢什么"？

**检 4（场景诊断）**：一个 agent 跑了 50 步后开始"忘"最初的用户约束（比如要求的输出格式），最可能是哪种策略（或哪类管理缺失）的副作用？给一个缓解方案。

## 入口 B 小检批改（2026-11-24）

**检 3 ✅ 正确**：/compact = 压缩策略，保大意丢细节。

**检 4 ✅ 正确 + 补一个生产要点**：诊断为截断的副作用（128K 上限触发裁剪，最早轮次被丢、首轮约束随之丢失）——正确。缓解方案"压缩，手动或超阈值自动"成立。补充最重要的生产实践：**持久性约束不该住在会话历史里**——把输出格式这类硬约束放进 system prompt（每轮必发、永不裁剪），历史里只放易变内容；压缩时也可在压缩指令里显式要求"保留用户硬约束清单"。

**入口 B 闭环** ✅。**置信度**：0.5 → 0.55。按学习者既定顺序，进入口 C = 正式讲解 `agent-memory`（见 agent-memory-2026-11-24.md 会话）。
