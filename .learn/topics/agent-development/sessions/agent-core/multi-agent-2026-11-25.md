# 讲解会话：多智能体编排（agent-core · multi-agent）

> 日期：2026-11-25 · 阶段 1 第 6 个概念 · 讲解对象：Vue3+TS 前端开发者，有 Dify 工作流经验
> 前置衔接：tool-calling（回合）→ agent-loop（循环）→ agent-memory（记忆）→ mcp（工具接入）→ 本讲：**把一个大 agent 拆成一支团队**

---

## 一、定位：它是什么，为什么是基石

**多智能体 = 把一个"什么都干"的大 agent 拆成多个职责明确的 agent，用编排协作完成任务。**

一句话记住：**多智能体解决的是"上下文经济学"问题——单一窗口装不下、工具太多注意力稀释；用组织分工换专注与隔离。**

图谱位置：

```
tool-calling → agent-loop → agent-memory → mcp → multi-agent ★你在这里 → agent-evaluation
```

与已学概念的接缝（本概念的底层真相）：
- **subagent 就是一个被封装成工具的完整 loop**：主 agent 发 tool_calls 意图 → host 启动一个新的 agent loop 跑 subagent → 最终报告作为 tool result 回传
- 每个 subagent 有自己独立的 messages、记忆、工具清单（可能还各自接 MCP server）——前面四个概念在这里全体复用

## 二、核心机制

### 2-1 主/子模式（orchestrator–worker）

主 agent 负责分解、分发、汇总；subagent 各自干活。**关键收益：上下文隔离**——subagent 海量的中间步骤（读几十个文件、上百条工具观察）不污染主上下文，主 agent 只收到一份最终摘要。

Claude Code 本身就是这个模式：Agent 工具派生 subagent，跑完只把最终报告发回来。

### 2-2 编排拓扑：三种基本形

| 拓扑 | 形态 | 类比 |
|---|---|---|
| **pipeline** | A→B→C 顺序流水线，上游输出是下游输入 | 中间件链 / Dify 工作流的线性连线 |
| **parallel** | 扇出并行跑、汇聚合并 | `Promise.all` / map-reduce |
| **orchestrator** | 主 agent **运行时**决定派谁、派几个、派几次 | 动态调用子组件 |

这里重现第一课就立起的那根轴：**Dify 工作流 = 静态图（连线在搭建时画死）；orchestrator 多智能体 = 动态决策（派谁由模型现场判断）**。两者不是优劣关系——任务结构固定用静态图便宜可控，任务结构需探索才值得动态。

### 2-3 通信 = 结构化 handoff（消息传递，不共享内存）

- subagent 之间**默认零共享**——没有共同的可变内存；一切交接靠结构化结果（JSON 摘要）
- 类比函数调用：主函数调子函数，传参进、返回值出，局部变量互不可见
- **设计 handoff 格式 = 设计系统的信息带宽**：摘要太瘦主 agent 决策缺料，太胖隔离失效

### 2-4 上下文经济（呼应 context-window）

- 主上下文对每个 subagent 只增一份摘要 → 增量 O(1)，而不是吃进全部中间步骤
- 代价：**handoff 损耗**（总结丢细节）——和压缩策略同一个权衡
- 注意：隔离省的是**主上下文的窗口和注意力**，不是总 token——每个 subagent 各自带 system prompt 和工具描述，总消耗常常更高

### 2-5 何时该拆、何时不该拆（工程判断，考试重点）

**值得拆**：
- 子任务真正独立、可并行（如多路资料搜集）
- 单域工具集过大（探索工具和写码工具塞给同一个 agent 会互相稀释）
- 需要上下文隔离（探索性搜索会产生海量观察，主 agent 不该看全量）

**不值得拆**：
- 任务强串行依赖（后一步吃前一步的完整细节）
- 上下文本来就小（拆了徒增协调成本与 handoff 损耗）

一句话：**多智能体不是银弹，是上下文经济学——拆是为了专注与隔离，不是为了"更多 agent 更聪明"。**

## 三、类比锚点

- **前端组件**：主 agent ≈ 容器组件，subagent ≈ 子组件——props 进、emit 出，父组件看不见子组件内部状态（作用域隔离即上下文隔离）；pipeline ≈ 中间件链；parallel ≈ `Promise.all`。
- **公司组织**：主管拆任务给专员、收报告——不看你加班的全过程，只看结论。
- **Dify**：你搭的工作流就是静态 pipeline 编排（节点和连线固定）；orchestrator 是模型运行时动态派单——静态图 vs 动态决策。
- **DSH**：platform-design 阶段的核心架构决策预演——固定场景拆成"核心平台 + 业务插件"，主 agent + 场景 subagent 的形态。

## 四、代码示例：最小 orchestrator（阅读向）

```typescript
const subagents = {
  researcher: defineAgent({ tools: [webSearch], system: "只做资料搜集" }),
  coder:      defineAgent({ tools: [readFile, writeFile], system: "只改代码" }),
};

async function orchestrator(task: string) {
  const plan = await llm.plan(task);                       // 主 agent 拆解任务
  const results = await Promise.all(
    plan.steps.filter(s => s.parallel).map(s =>
      runLoop(subagents[s.who], s.instruction)             // 每个 subagent：独立 messages 跑完整 loop
    )
  );
  return await llm.synthesize(                             // 只收最终摘要
    task,
    results.map(r => r.summary)
  );
}
```

两个设计决策：
1. `runLoop` 就是已学的 agent loop——**多智能体 = loop 的函数化组合**，没有任何新原语。
2. 交接只有 `summary`——subagent 的全部中间过程留在它自己的上下文里，随循环结束丢弃。

## 五、常见误区

1. **"多智能体 = 更聪明"** —— 协调成本、handoff 信息损耗、错误传播（上游错下游全错）；单 agent 能搞定就别拆。
2. **"subagent 之间共享记忆"** —— 默认零共享；要共享必须显式设计（共享 store / 黑板模式），隐式共享是竞态和幻觉的温床。
3. **"并行就一定快"** —— 有依赖的步骤并行会互相等、甚至用错前提；先判依赖再并行。
4. **"主 agent 全知"** —— 主 agent 只见摘要；subagent 撒谎/总结失真，主 agent 无法察觉——这就是为什么评估（下一概念）要看全轨迹而不只看最终输出。

## 六、苏格拉底自检（开放式纯问答）

**Q1（判断）**："把任务拆给多个 subagent 并行跑，总 token 消耗会更省。"——对吗？

**Q2（机制衔接）**：subagent 在机制上是怎么被调用的？它和 tool calling 是什么关系？

**Q3（设计权衡）**：你的 DSH 场景智能体要做"代码库理解 + 重构建议"任务。哪些部分值得拆成 subagent，哪些不值得？为什么？

---

## 苏格拉底问答记录（学习者作答 · 2026-11-26）

**Q1 ❌ 答错（本概念第一个掌握缺口）**：答"对，每个子 agent 独立窗口、只给主摘要，避免单 agent 长链的极大上下文"——**不对**。混淆点：把"主上下文省"答成了"总 token 省"。
- 学习者的推理描述的是**主上下文的节省**（隔离生效，主 agent 只收摘要）——这部分完全正确。
- 但"总 token" = 所有 subagent 消耗之和：每个 subagent 自带 system prompt + tools schema + 任务简报（重复背景），N 个子 agent = 固定开销 × N；单 agent 长链 50K 的工作量，拆 5 个子 agent 后常常是 5×(5K 开销 + 各自中间步) + 主 agent 协调，**总账更多**。
- 结论：多智能体买的是**专注、隔离、并行墙钟时间**，不是 token 折扣——常常是"花更多钱买更干净的上下文"。
- **判别式（记）**："省"的主语是谁——主 agent 的上下文 ✅ 省；系统总账单 ❌ 通常涨。
- 前端类比：拆组件不减少代码总量（每个子组件都有自己的 props 定义与导入），省的是**父组件**的复杂度。

**Q2 ✅ 正确且精准**：模型思考认为需要拆分时调 tool 启动子 agent，结束后传回结果，主→子→主 ≈ 模型→tool→模型。正是"subagent = 封装成工具的完整 loop"。补一层：子 agent 运行期间，主 loop 停在该工具调用上等待返回（host 可并行调度多个此类工具调用实现真并行）。

**Q3 ✅ 超预期**：模块解耦 → 按模块并行拆理解子 agent（判据"独立可并行"用对）；理解→重构是强依赖链，不能粗暴拆（判据"强串行不拆"用对）。补一层：综合重构建议适合**主 agent**亲自做——需要跨模块全局视野 + 与用户交互，而 handoff 损耗对"综合决策"伤害最大。

**置信度**：0.25 → 0.3。

## 递归入口 A：handoff 协议深挖（结果 schema / 信息带宽 / 黑板 vs 消息）

### A-1 handoff 报告的 schema 设计

```typescript
interface HandoffReport {
  task: string;            // 原始指令回显（供主 agent 对账）
  status: "done" | "partial" | "failed";   // 完成度显式化——失败传播的开关（入口 B 的钩子）
  summary: string;         // 结论摘要（主 agent 决策的原料）
  keyFindings: string[];   // 结构化要点（比自由文本可比对）
  artifacts: { path?: string; ref?: string }[];  // 产物引用：大内容落盘，上下文只留路径/ID
  openQuestions: string[]; // 未决问题：显式暴露不确定性，防摘要"看起来很确定"
  stats: { steps: number; tokens: number; durationMs: number };  // 观测（衔接 agent-evaluation）
}
```

三个设计原则（全是老概念的重逢）：
1. **status 显式化** ≈ agent-loop 课的 stopReason 显式化——主 agent 能程序化判断成败，而不是读摘要猜语气。
2. **大产物落盘、只留引用** ≈ context-window 课的"大工具结果不进历史"。
3. **zod 校验报告** ≈ structured-output 桥接——schema 不合把校验错误回给 subagent 重报。

### A-2 信息带宽权衡

- 太瘦（一句话结论）→ 主 agent 决策缺料，靠幻觉补全。
- 太胖（全量中间结果）→ 隔离失效，等于白拆。
- 实操基线：summary 几百 token 内；keyFindings 3–7 条；细节进 artifacts 引用、按需取。
- 前端类比：API 响应设计——DTO 只返回视图需要的字段，全表 dump 是反模式。

### A-3 黑板模式 vs 纯消息传递

| | 纯消息传递（默认） | 黑板模式（blackboard） |
|---|---|---|
| 结构 | subagent 零共享，一切经主 agent 转发 | 共享一块结构化存储，各自认领任务、写入结果 |
| 优点 | 职责清晰、无竞态、可追责 | 无转发瓶颈、大体量中间产物不用过主上下文 |
| 缺点 | 主 agent 成转发瓶颈、信息二手失真 | 竞态（两人同改一块）、需要锁/版本约定、追责难 |
| 适用 | 绝大多数编排 | 多 agent 共建大体量产物（如合写一份长文档） |

记忆钩子：**消息传递 = 函数调用（传参/返回值），黑板 = 全局变量（要纪律）**。
Vue 同构：消息传递 = props/emit 单向数据流（推荐）；黑板 = 绕过 action 直接改全局 store（能跑，出事难查）。默认消息传递，黑板只在共享产物太大、不值得经主 agent 转发时用。

### 入口 A 小检（读码判断 × 1 + 场景设计 × 1）

**检 1**：某个 subagent 的报告只返回 `{ summary: "完成了，改了 12 个文件" }`，主 agent 接下来要汇总最终报告给用户。指出这个 handoff 设计的至少两个缺陷。

**检 2（场景设计）**：三个 subagent 共建一份 50 页技术方案文档，各负责几章。用纯消息传递会有什么问题？你会怎么改？

---

## 入口 A 小检批改（学习者作答 · 2026-11-26）

**检 1 ✅ 三个缺陷全对**：①无 status → 主 agent 无法程序化判断完成度，易幻觉补全；②无 task 回显 → 报告无法对账，可能被当成其他任务的回复；③无 artifacts → 细节丢失，无法回看/审计。

**stats 缺失的副作用（学习者主动追问，已答）**：
1. **成本失控不可见**——token 是真金白银（context-window 课），不知道哪个 subagent 在烧钱。
2. **优化无基线**——改了 subagent 的 prompt 后，steps/tokens/duration 是判断"变好还是变贵"的量化依据；没有 stats，调优全靠感觉（agent-evaluation 的原料）。
3. **异常检测缺失**——steps 异常多 ≈ 内部循环（loop 检测老话题）；tokens 突增 ≈ 重复检索；duration 超阈 → 该触发超时降级（入口 B 的钩子）。
4. **容量规划不可能**——"这类任务该拆几个子 agent"无法数据化，拆分策略拍脑袋。

**检 2 ⚖️ 部分对，核心方案漏**：
- 抓到 ✓：报告缺 task/身份标识 → 主 agent 错认章节归属、整理顺序错乱；纯消息传递只剩摘要 → 细节丢失。
- 漏掉 ✗：**该场景的正确解法是黑板模式**（A-3 刚讲的）——50 页正文必须有个"共同存放地"。纯消息传递下两难：正文全量过主 agent → 上下文爆炸 + 转发瓶颈；只传摘要 → 没人真正写文档。"严格按 handoff 规范写响应"只解决了归属问题，解决不了体量问题。
- 点睛：handoff 的 **artifacts 落盘引用其实就是最朴素的黑板**——磁盘就是共享存储，报告只留路径。正规黑板再加"章节认领 + 锁/版本约定"防两人同写一章。

## 三协议关系评价（学习者综合 · 2026-11-26）

学习者命题：handoff 控制多智能体间通信；JSON-RPC 控制 MCP 与智能体间通信；tool schema 约束工具与模型间通信格式——共同点是"不同角色间通信的结构约束"，层级为包容关系 handoff > rpc > schema。

**逐条评**：
1. **共同点 ✅ 抽象准确**——三者都是"跨角色的结构化通信约束"，同一思想撒在不同边界。且都体现同一哲学：**意图用结构表达，数据用契约约束**（structured-output"同一机制两面"的延伸）。
2. **handoff 定位 ✅**——补一点：它**没有行业标准**，是应用层自定义约定（前两者是公开规范）。
3. **JSON-RPC 定位 ⚠️ 方向精修**——通信双方是 **host（内嵌 client）↔ MCP server**，说"MCP 与智能体之间"方向反了（server 不主动找 agent）；且 JSON-RPC 本身是通用线格式，MCP 只是借用它。
4. **tool schema 定位 ⚠️ 需修正**——"工具与模型之间的通信"**不存在**：模型与工具从不直接说话，host 全程中转（学习者在 mcp Q1 自己答对过这点！）。tool schema 是 **host↔模型** 边上的约束：host 用它描述"有什么可调"，模型输出意图被它约束。
5. **层级包容论 ❌ 结论错，但有真洞见**：
   - 正确模型：三者是**兄弟关系——同一种思想，钉在三条不同的通信边上**，不是相互包含的层级：
   ```
   edge1  模型 ←── tool schema 约束 tool_calls 意图 ──→ host
   edge2  host ←── JSON-RPC 线格式（MCP） ──→ MCP server
   edge3  主agent ←── handoff 报告约定 ──→ subagent
   ```
   - 学习者的洞见来自真实存在的"携带链"：子 agent 作为工具被调时，**tool result 信封里装着 handoff 报告内容**；MCP 的 tools/list 返回里**装着 inputSchema 数据**。但这是**特定路径上的信封携带（组合）**，不是协议间的层级包含。
   - 反例证伪"严格包容"：黑板模式下 handoff 报告走文件/DB，**完全不经过** schema 和 rpc——若真是 handoff⊃rpc⊃schema 的包含层级，这不可能发生。

**综合判定**：抽象共同点 ✔、单点定位基本对（两处方向精修）、层级论修正为"同思想 × 不同边 × 路径上组合"。

**置信度**：0.3 → 0.35（检1 全对 + 主动追问 stats + 敢提综合命题且命题质量高；检2 部分对）。

## 递归入口 B：失败传播深挖（重试 / 部分合并 / 超时降级）

### B-1 失败来源与显式化

subagent 的四种失败：loop 刹车触发（max_steps/循环检测——agent-loop 老）；handoff 报告 zod 校验失败；真完成但 partial（openQuestions 非空）；执行报错。判定依据 = `HandoffReport.status` + `openQuestions`——A 入口埋的钩子在这里接上。

### B-2 重试：谁决定？模型！

- 主 agent 收到 `status:"failed"` → 失败**原因文本**作为观察 → 模型决策：改指令重试 / 换 subagent / 降级 / 上报用户——**又是"错误即观察"**。
- **盲重试反模式**：同参数重试三次 = agent-loop 课里循环刹车该拦的情形——重试必须携带**新信息**（改指令、缩范围、换工具）。
- 分工：**瞬时错误**（网络抖动）host 层可做有限自动重试；**语义性失败**（指令不当、前提错误）交给模型判断。

### B-3 部分结果合并（partial 的价值）

- `status:"partial"` ≠ 丢弃：keyFindings 里已确认部分照用，openQuestions 指明缺口。
- 补救策略：主 agent **补派一个窄范围 subagent** 只补缺口——比全量重跑便宜得多。
- **前端同构：`Promise.allSettled` 而不是 `Promise.all`**——一个失败不全军覆没，fulfilled 的照常处理、rejected 的单独补救。parallel 拓扑若用 all 语义，一个 subagent 失败 → 全部作废 → 已成功的算力白烧。

### B-4 超时与降级

- **超时**：host 给每个 subagent loop 设预算（时间/token——context-window 课的 budget 思想）；超时前注入系统消息让它总结已有进展（agent-loop 课优雅中断的复用）——partial 报告比空白强。
- **降级阶梯**：完整 subagent → 缩范围重试 → 主 agent 用粗工具自己顶上 → 向用户明示限制。降级是 agent-loop"软刹车"思想在编排层的延续。
- 全程 stats 落日志 → 事后回放（agent-evaluation 的原料，C 入口见）。

### 入口 B 小检（判断 × 1 + 决策树 × 1）

**检 3（判断）**："parallel 拓扑应该用 Promise.all 语义：任何一个 subagent 失败就整体失败取消，保证结果纯净。"——对吗？为什么？

**检 4（决策树）**：主 agent 收到 `status:"failed"`，错误文本"搜索 API 限流（429）"。写出主 agent 接下来的决策分支（至少两个），并指出这整体体现的是哪个已学概念。

---

## 入口 B 小检批改（学习者作答 · 2026-11-26）

**检 3 ✅ 全对**：不对——整体取消导致其他 subagent 的上下文白费，重启下一轮还要重新输入、浪费 token。应并行照常执行，失败/partial 总结汇报给主 agent，由**主决定**能否自行解决（重新派子 agent / 换 tool / 调参数），不能则总结原因交用户——allSettled 语义 + 主 agent 决策闭环全部到位，浪费归因（重输入=重复 token）准确。

**检 4 ✅ 概念对，两分支合理**：①按 429 详细信息定时等待后重访；②等其他 agent 完成后汇总失败原因上报用户。概念：**错误即观察**。补锐：429 属**瞬时错误**——host 层可自动 backoff 重试，但重试次数/等待必须有上限（否则变成盲重试，循环刹车思想）；分支还可加"换搜索工具/缩范围查询"。

**入口 B 关闭**。置信度 0.35 → 0.4。入口 C = agent-evaluation 正式讲（agent-core 域收官概念）。

## 七、递归入口

- **A. handoff 协议深挖**：结果 JSON schema 设计、信息带宽权衡、共享黑板模式 vs 纯消息传递
- **B. 失败传播深挖**：subagent 失败重试、部分结果合并、超时与降级——衔接 agent-evaluation
- **C. 主线**：图谱顺序下一个概念 `agent-evaluation` 正式讲（agent-core 域最后一个）

## 讲解小结

- 多智能体 = 上下文经济学：用组织分工换专注与隔离，不是"agent 多 = 更聪明"。
- subagent = 封装成工具的完整 loop；主 agent 只收摘要（上下文隔离 + handoff 损耗的权衡）。
- 三拓扑：pipeline / parallel / orchestrator——Dify 静态图 vs 模型动态派单是那根老轴。
- 拆分判断：独立可并行、工具域过大、需隔离 → 拆；强串行、上下文小 → 不拆。
