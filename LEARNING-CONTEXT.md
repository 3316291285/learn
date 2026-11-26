> 📊 **学习进度：12%** ｜ 公式：Σ(各概念 confidence) ÷ 25 ｜ 已 mastered：0/25 ｜ 进行中：tool-calling(0.55)、agent-loop(0.55)、agent-memory(0.45)、context-window(0.3)、mcp(0.4)、multi-agent(0.4)、agent-evaluation(0.25) ｜ 更新：2026-11-26

# LEARNING-CONTEXT.md — 学习交接上下文

> 用途：本文件是跨会话学习交接文档。在项目中的 Claude Code 里开始学习前，先完整阅读本文件，再按「下一步行动」执行。
> 生成时间：2026-11-24 · 由 DSH 会话（learn-anything 项目运行 + 学习计划制定）整理；2026-11-26 因误推送丢失后重建（内容恢复并同步最新进度）

---

## 1. 学习者画像

- **技术背景**：前端开发，Vue3 + TypeScript 较熟练；C / Python / Node.js 仅能读懂代码，未系统写过。
- **Agent/LLM 平台经验**（2026-11-24 补充）：**使用过 Dify 开发工作流并部署使用**——具备可视化 Agent 编排的实操经验，讲解 tool-calling / agent-loop 等概念时可拿 Dify 的工作流节点（LLM 节点、工具节点、条件分支）作类比锚点。
- **学习风格偏好**：结合真实项目与官方文档，**重知识点的理解**；按递归式讲解推进；代码仅作理解辅助（阅读/运行演示代码）。
- **递归推进偏好**（2026-11-24 指示）：每个概念的递归入口按 **A → B → C 顺序全部进入**讲解，每入口附小检、答完才推进下一入口。
- **练习形式偏好**（2026-11-24 更新）：`/learn:practice` 出**选择/判断/问答类题目**（含"对一段代码做判断与解释"的读码题），在对话中作答、按答题表现更新 state；**不出手写代码题**。讲解的"苏格拉底自检"保持开放式纯问答不变；`/learn:quiz` 维持问答形式不变。

## 2. 学习目标（双目标，依次递进）

1. **近期目标**：掌握 Agent 开发基础，并与自身技术栈（TS/Node）对齐。
2. **终极目标**：基于 **DSH（deepseek-harness，DeepSeek 官方桌面 Agent 平台，Electron + pnpm monorepo）** 做二次开发——固定场景、以 **cordis 插件化** 形式开发业务插件，做成**场景专用智能体平台**。

DSH 本地源码位于 `C:\Users\Administrator\Desktop\projects\deepseekHarness\deepseek-harness`（2026-11-24 授权更新：**允许按需编辑**，如调试/实验需要；默认仍以只读研究为主，改动需谨慎）。

## 3. 硬约束（必须遵守）

- **默认只在 workspace 内编辑/写入**（`E:\私有项目\learn-anything-main`）；DSH 源码目录**按需允许编辑**（2026-11-24 用户授权更新，如调试/实验需要；默认仍以只读研究为主）。
- 学习数据以 `.learn/topics/agent-development/state.json` 为**唯一数据源**；`knowledge-map.md` 由脚本生成，**禁止手写**。
- 每次状态变更后：更新 state.json → 重跑渲染脚本 → **同步更新本文件首行进度行**。

## 4. 当前学习状态（截至 2026-11-26）

- 主题：`agent-development`（25 概念 / 5 域）。
- **阶段 1 进展**：`agent-core` 域 **6/6 全部讲完**（tool-calling 0.55、agent-loop 0.55、agent-memory 0.45、mcp 0.4、multi-agent 0.4、agent-evaluation 0.25，全部 in_progress，待 quiz 晋级 mastered）；`llm-basics` 域已讲 context-window(0.3)，剩 llm-api / prompt-engineering / structured-output。
- 已确认的首个知识点闭环：tool-calling 练习（11/11 测试全绿，Strong）；各概念递归入口小检大多当场闭环，个别（如 MCP 错误双轨制）经两轮澄清后闭合。
- 关键文件：
  - 数据源：`.learn/topics/agent-development/state.json`
  - 知识图谱：`.learn/topics/agent-development/knowledge-map.md`（脚本自动渲染，勿手写）
  - 会话记录：`.learn/topics/agent-development/sessions/<domain-slug>/<concept>-<日期>.md`（含全部讲解、问答批改、递归入口内容）
  - 练习代码：`.learn/topics/agent-development/exercises/tool-calling/`（vitest 11 测试全绿）

### 概念清单（5 域 × 概念，slug 用于命令调用）

| 域 | 概念（slug） |
|---|---|
| LLM 基础与 Prompt 工程（llm-basics） | llm-api · prompt-engineering · structured-output · context-window★ |
| Agent 核心机制（agent-core） | tool-calling★ · agent-loop★ · agent-memory★ · mcp★ · multi-agent★ · agent-evaluation★ |
| Cordis 插件框架（cordis-framework） | cordis-context · lifecycle-effects · services-inject · cordis-events · plugin-config · composition-hmr |
| TypeScript 工程补强（ts-engineering） | node-async-stream · ts-advanced-types · monorepo-pnpm · testing-vitest |
| DSH Harness 平台实战（dsh-harness） | harness-plugin · harness-tool · llm-adapter · plugin-publish · platform-design |

（★ = 已讲/进行中）

**针对背景的取舍**：Vue3+TS 已熟，TS 域只补后端向缺口（Node 子进程/流、`declare module` 声明合并、pnpm monorepo——cordis 源码高频用到）；C/Python 不单独设域。

## 5. 学习计划（四阶段，约 5–7 周）

- **阶段 1 · Agent 原理（约 1 周）**：`agent-core` + `llm-basics`。agent-core 已全部讲完；剩余 llm-basics 三概念（llm-api / prompt-engineering / structured-output）。
- **阶段 2 · Cordis 框架（约 1–1.5 周）**：`cordis-framework`。跟官方 7 章教程走（01-first-plugin → 07-into-the-harness）。核心心智模型：**插件即函数，挂到共享 Context；工具、LLM 适配器、agent loop 本身都是插件**。
- **阶段 3 · DSH 实战（约 1–2 周）**：`dsh-harness`。文档三进阶：基础（第一个插件/开发 Tool/配置/打包安装）→ 框架能力（生命周期/服务依赖/事件）→ 实战（能力三层拆分/LLM 适配器/持久化插件）。
- **阶段 4 · 平台设计（收尾）**：`platform-design`。把固定场景拆成「核心平台 vs 业务插件」两层，设计文档写到工作区内。
- `ts-engineering` 域不单独占阶段，随用随学（阶段 2 会自然用到声明合并与 monorepo）。

## 6. 工作流与命令用法

在 Claude Code 中使用以下命令（本项目 `.claude/commands/learn/` 已生成）：

| 命令 | 作用 | 节奏建议 |
|---|---|---|
| `/learn:topic <主题>` | 初始化/加载学习主题 | 已完成，无需再跑 |
| `/learn:explain <概念slug>` | 苏格拉底式递归讲透一个概念 | 每个新概念先 explain |
| `/learn:practice <概念slug>` | 练习并更新置信度 | **改版**（2026-11-24）：出选择/判断/问答类题目（含读码判断）在对话中作答，不写代码 |
| `/learn:review [主题]` | 间隔重复推荐 | 每周 1–2 次 |
| `/learn:status [主题]` | 知识图谱热力图 | 阶段末自查 |
| `/learn:quiz <概念slug>` | 快速问答，记录待重练 | **主要巩固手段** + 碎片时间；对已讲概念做延迟闭卷测验 → 达标晋级 mastered |

状态流转协议：概念 `status ∈ unexplored | in_progress | needs_practice | mastered`，`confidence ∈ 0–1`；每次 explain/practice/quiz 后**必须**更新 `state.json` 对应概念的字段（explain_count/practice_count/last_explained/last_practiced/details），然后重跑渲染脚本刷新知识图谱。概念晋级规则（2026-11-24 调整）：**explain 讲透 + quiz 表现达标即可晋级 mastered**，不再强制 practice_count ≥ 2。每次 state 变更并重跑渲染后，**同步更新本文件首行的进度行**（Σconfidence ÷ 25，列出进行中概念）。

### 状态更新脚本（改完 state.json 后必须执行对应脚本）

- 主题图谱：`node .claude/skills/learn-anything-topic/scripts/render.mjs ./.learn/topics/agent-development`
- 讲解收尾：`node .claude/skills/learn-anything-explain/scripts/render.mjs ./.learn/topics/agent-development`
- 练习收尾：`node .claude/skills/learn-anything-practice/scripts/render.mjs ./.learn/topics/agent-development`
- 测验收尾：`node .claude/skills/learn-anything-quiz/scripts/render.mjs ./.learn/topics/agent-development`（判分用 `validate-quiz.mjs`）
- 进度总览：`node .claude/skills/learn-anything-status/scripts/status.mjs ./.learn/topics/agent-development`

浏览器仪表盘（可选）：`node packages/cli/bin/learn-anything.js serve --no-open`

## 7. 参考资料

- **DSH 官方开发文档**：https://deepseek-harness.github.io/deepseek-harness/develop/cordis-tutorial/
  - Cordis 7 章教程：01-first-plugin / 02-lifecycle-and-effects / 03-services / 04-events / 05-config / 06-composition-and-hmr / 07-into-the-harness
  - DSH 插件开发：/develop/basic/（第一个插件、Tool、config、publish）、/develop/framework/（生命周期、service、events）、/develop/practice/（三层拆分、llm-adapter、dynamic-cordis）
- **DSH 技术事实**（已侦察确认）：核心依赖 `@deepseek-ai/cordis` 4.1.0（cordisjs 分叉，vendor 在 `vendor/cordis`）+ cordis-plugin-loader；`cordis.yml` 即插件树；启动器 `node --import tsx ../../vendor/cordis/bin.js`；TS 要点 = 类型注解、import type、declare module 声明合并、`Schema<Config>`。
- Agent 通识：tool calling / ReAct / MCP / 记忆 / 多智能体 / 评估（阶段 1 内结合实操讲，已完成 agent-core 全域）。

## 8. 环境备注（Windows）

- Node v22.22.0；pnpm 10.34.9（已全局安装）。
- 本仓库已修复一个 Windows/Node 兼容 bug：`packages/cli/scripts/bundle-site.mjs` 中 `cpSync(recursive)` 会硬崩溃（0xC0000409），已替换为自实现 `copyDirRecursive`——若重新拉取上游代码需注意。
- CLI 本地调用方式：`node packages/cli/bin/learn-anything.js <cmd>`；全局化：`cd packages/cli && npm link`。
- `pnpm test` 基线：562 全过（CLI 270 + site 292）。
- **2026-11-26 事故与重建**：本地仓库误关联远程 git 并推送，导致根目录 LEARNING-CONTEXT.md 与 命令.md 被清掉（两文件未入 git，无法从历史恢复），已当日重建；`.learn/` 学习数据未受影响。**教训：推送/重置前确认未跟踪的学习文档；考虑把学习数据纳入版本管理或单独备份。**

## 9. 下一步行动（新会话从这里开始）

1. 阅读本文件后确认状态：阶段 1 过半——agent-core 6/6 已讲完（全部 in_progress），llm-basics 剩 3 概念。
2. **巩固优先**：对已讲概念做延迟闭卷测验晋级 mastered：`/learn:quiz tool-calling`、`/learn:quiz agent-loop`、`/learn:quiz agent-memory`、`/learn:quiz mcp`、`/learn:quiz multi-agent`。
3. **主线推进**：`/learn:explain llm-api` → `/learn:explain prompt-engineering` → `/learn:explain structured-output`（llm-basics 收尾 = 阶段 1 完成）。
4. 每完成一个概念按第 6 节协议更新 `state.json` + 重跑渲染 + 维护首行进度行；每周末跑 `/learn:review`。
