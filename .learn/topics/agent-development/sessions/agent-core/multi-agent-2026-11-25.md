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

## 七、递归入口

- **A. handoff 协议深挖**：结果 JSON schema 设计、信息带宽权衡、共享黑板模式 vs 纯消息传递
- **B. 失败传播深挖**：subagent 失败重试、部分结果合并、超时与降级——衔接 agent-evaluation
- **C. 主线**：图谱顺序下一个概念 `agent-evaluation` 正式讲（agent-core 域最后一个）

## 讲解小结

- 多智能体 = 上下文经济学：用组织分工换专注与隔离，不是"agent 多 = 更聪明"。
- subagent = 封装成工具的完整 loop；主 agent 只收摘要（上下文隔离 + handoff 损耗的权衡）。
- 三拓扑：pipeline / parallel / orchestrator——Dify 静态图 vs 模型动态派单是那根老轴。
- 拆分判断：独立可并行、工具域过大、需隔离 → 拆；强串行、上下文小 → 不拆。
