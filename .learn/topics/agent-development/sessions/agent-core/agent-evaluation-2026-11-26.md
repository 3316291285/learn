# 讲解会话：Agent 评估与调试（agent-core · agent-evaluation）

> 日期：2026-11-26 · 阶段 1 第 7 个概念 · **agent-core 域收官** · 讲解对象：Vue3+TS 前端开发者，有 Dify 工作流经验
> 前置衔接：loop（刹车/stopReason）、context-window（stats/token 计量）、mcp（审计日志）、multi-agent（HandoffReport.stats + 失败传播）——全域铺的伏笔在本讲收拢

---

## 一、定位：它是什么，为什么是基石

**评估与调试 = 给 agent 行为建立可量化、可回放、可回归的反馈回路。**

一句话记住：**agent 是非确定性系统——同样的输入不保证同样的输出；没有评估的优化是玄学调参。**

图谱位置：

```
tool-calling → agent-loop → agent-memory → mcp → multi-agent → agent-evaluation ★你在这里（域收官）
```

全域伏笔收拢：
- agent-loop：刹车触发记录、stopReason 显式化 → 可统计"为什么停"
- context-window：token/步数计量 → 成本指标
- mcp：审计日志 → 工具调用可回放
- multi-agent：HandoffReport.stats + 失败传播 → 子 agent 级观测

## 二、核心机制

### 2-1 轨迹（trace）是评估的第一公民

一次完整运行 = 一条轨迹：每步的模型调用、工具调用与结果、token 数、耗时、停止原因，结构化落盘（JSONL 一行一步）。

```typescript
interface TraceStep {
  step: number;
  toolCalls?: { name: string; args: unknown; durationMs: number; ok: boolean }[];
  tokens: { input: number; output: number; cached?: number };
  stopReason?: string;               // agent-loop 课的显式化，在这里变成统计维度
}
type Trace = TraceStep[];
```

**为什么必须看轨迹而不只看最终结果**：只看结果会漏掉两类隐患——"蒙对的"（步骤错误结论碰巧对）与"绕远路的"（对了但花了 40 步 + 20 万 token）。前者是稳定性地雷，后者是成本地雷。

类比：前端的 Performance 面板 / 请求 trace——页面"看起来快"不算数，要看火焰图里时间花在哪。

### 2-2 评估的三层

| 层 | 评什么 | 谁判定 | 类比 |
|---|---|---|---|
| **单步断言** | 工具选对没、参数合法没、schema 过没 | 程序（自动） | vitest 单测 |
| **轨迹评估** | 步数合理没、绕路没、刹车该不该触发、成本在预算内没 | 规则 + 启发式 | E2E 测试看交互序列 |
| **结果评估** | 最终答案对不对、好不好 | LLM-as-judge（按 rubric 打分）+ 人工抽检 | 验收测试 |

### 2-3 评估集（eval set）与回归

- 固定一批任务用例 + 各自的判定器（judge）→ 每次改动（prompt / 模型 / 工具描述）全量重跑对比分数。
- 核心纪律：**prompt 是代码，改 prompt 要跑测试。** 改完 system prompt 没跑评估集就上线 = 改完代码不跑单测就部署。
- 回归门禁：分数低于历史基线 → 禁止上线（CI 思想）。

### 2-4 调试方法论

```
复现（从轨迹回放）→ 定位（哪一步开始偏离）→ 假设（prompt 歧义？工具描述不清？缺上下文？）
   → 改动 → 重跑评估集回归
```

轨迹回放 = "时间旅行调试"：不改代码，把当时的 messages 原样重发给模型或单步检查。

### 2-5 常用指标（数据源全域已铺好）

任务成功率 · 平均步数 · token 成本（input/output/cached 分开）· 工具调用错误率 · 刹车/循环触发率 · 首 token 延迟 · （多智能体）各 subagent 的 stats 分布。

## 三、类比锚点

- **前端测试金字塔**：单步断言 ≈ vitest 单测；轨迹评估 ≈ E2E；LLM-judge ≈ 自动化验收；评估集 ≈ 快照测试集；回归门禁 ≈ CI 流水线。
- **Dify**：应用日志 + 标注功能 = 朴素评估（人工标注好坏、对比版本）——你已经用过它的"手动版"。
- **DSH**：**固定场景是评估的最大优势**——任务类型有限，评估集可以穷举核心场景；通用 agent 永远凑不齐评估集，这正是"场景专用平台"工程质量上限更高的原因（你的终极目标直接受益）。

## 四、代码示例：最小评估跑批器（阅读向）

```typescript
interface EvalCase {
  id: string;
  input: string;                                           // 用户任务
  judge: (trace: Trace, answer: string) => number;         // 0~1：程序断言或 LLM-judge
}

async function runEval(cases: EvalCase[], agent: (input: string) => Promise<{ trace: Trace; answer: string }>) {
  const results = [];
  for (const c of cases) {
    const { trace, answer } = await agent(c.input);        // 跑完整 agent，轨迹同时落盘
    results.push({ id: c.id, score: c.judge(trace, answer) });
  }
  const passRate = results.filter(r => r.score >= 0.8).length / results.length;
  const avgSteps = results.reduce((a, r) => a + r.trace.length, 0) / results.length;
  console.log(`通过率 ${passRate} · 平均步数 ${avgSteps} —— 低于基线则禁止上线`);
}
```

两个设计决策：
1. **judge 可插拔**——单步用程序断言（确定性），结果层用 LLM-judge（rubric 写死在 judge 的 prompt 里）。
2. **跑评估必然产出轨迹**——评估与调试共用同一份数据，评估失败的那条轨迹就是最好的调试素材。

## 五、常见误区

1. **"输出看着对就行，有问题再看日志"** —— 两层漏洞：非确定性系统这次对下次未必对（没回归保护）；"蒙对的"与"绕远路"只有轨迹能暴露。
2. **"LLM-judge 万能"** —— judge 自身有偏差（偏爱长答案、偏爱某种风格）；必须 rubric 固化 + 人工抽检校准 judge。
3. **"评估一次就完"** —— 每次改动都可能回归；评估是持续 CI，不是一次性验收。
4. **"只测离线评估集"** —— 会过拟合到题库；生产日志采样回放是最大的评估集（线上持续评估）。

## 六、苏格拉底自检（开放式纯问答）

**Q1（判断）**："我的 agent 输出看起来都对，所以不需要评估集，有问题再看日志。"——对吗？至少说出两层问题。

**Q2（机制衔接）**：用 LLM-as-judge 给"重构建议质量"打分，为什么 rubric（评分细则）必须写死在 judge 的 prompt 里而不让 judge 自由发挥？judge 本身还有什么风险？

**Q3（DSH 设计）**：你的 DSH 场景智能体要上线。设计一个最小评估方案：评估集放哪些用例？三层（单步/轨迹/结果）各挑一个自动判定项？

## 七、递归入口

- **A. LLM-as-judge 深挖**：rubric 设计、judge 偏差与人工校准、成对比较 vs 绝对打分
- **B. 轨迹回放与调试器深挖**：trace 格式设计（JSONL 细节）、时间旅行调试、与会话日志的关系
- **C. 主线**：`llm-api` 正式讲（llm-basics 域第一个概念，阶段 1 收尾三连的第一站）

## 讲解小结

- agent 是非确定性系统：评估 = 可量化、可回放、可回归的反馈回路，没有它优化就是玄学。
- 轨迹是第一公民——只看结果漏掉"蒙对的"和"绕远路的"。
- 评估三层：单步断言（程序）→ 轨迹评估（规则）→ 结果评估（LLM-judge + 人工抽检）。
- prompt 是代码：改 prompt 必须跑评估集，低于基线禁止上线。
- 固定场景 = 评估集可穷举 = 你的 DSH 平台的工程质量优势。
