# Agent 开发（面向 DSH 二次开发）

> 0/25 mastered · 0% complete

## LLM 基础与 Prompt 工程

- ⚪ **LLM API 调用基础** (unexplored)
  - messages 角色（system/user/assistant）
  - 采样参数：temperature / top\_p
  - OpenAI 兼容接口与 DeepSeek API
- ⚪ **Prompt 工程** (unexplored)
  - System prompt 设计
  - Few-shot 示例
  - 指令分层与角色设定
- ⚪ **结构化输出** (unexplored)
  - JSON mode / response\_format
  - 用 zod 校验模型输出
- 🔵 **Token 与上下文窗口管理** (in progress)
  - tokenizer 计费
  - 上下文压缩与裁剪策略
  - 已讲（经 agent-memory 入口 B 正式展开）：token≠字（中文 1 字≈1~1.5 token）；input+max\_tokens 共享窗口，tools schema 也占 token；prompt caching 奖励前缀稳定只追加（agent loop 天然受益）；三策略 API 层落地 + 大工具结果不进历史；压中间保两端
  - 问答反馈（2026-11-25）：Q1 对（O(N²) 累加必超窗）；Q2 未答到机制——已补讲 prompt caching（推理服务缓存前缀 KV cache，逐 token 精确匹配才命中，命中部分大幅计费折扣，故 system 须最前且稳定）；Q3 对（6000 token≈4.7%，提炼+克制正确）。0.25→0.3

## Agent 核心机制

- 🔵 **Tool Calling 工具调用** (in progress)
  - tool schema 定义（JSON Schema）
  - tool\_calls 消息回合
  - 并行工具调用与错误处理
  - 已讲：四步回合（清单→意图→本地执行→role:tool 回传）；模型不执行只输出 JSON 意图；arguments 是字符串需 parse；tool\_call\_id 必须对应；类比 Dify 工具节点（静态图 vs 模型动态决策）
  - 问答反馈：机制复述正确、Q3（description 作用）全对；Q1 曾误判'再次 tool\_calls=幻觉异常'，已纠偏为'多步任务的正常情形，循环处理即 agent-loop'；Q2 已补'错误即观察回传'模式
  - 练习完成（2026-11-24）：协议执行器 11/11 测试一次全绿（Strong，含'未知工具报可用列表'加分项）；Q1/Q2 认知缺口经代码验证已闭环
- 🔵 **Agent Loop 智能体循环** (in progress)
  - ReAct：感知→思考→行动→观察
  - 终止条件与最大步数
  - 流式输出与中断
  - 已讲：循环三要素（messages 状态/模型决策/三类刹车）；成本 O(N²)；stopReason 显式化 + 重复签名检测（语义刹车）；直接衔接练习手写的 runAgent（即 loop 1.0 版）
  - 问答反馈（含递归入口A）：Q1 方向对（累加）补齐 O(N²) 量化；Q2 超预期——自主发现 A→B→C 序列循环盲区与 B 类误杀权衡；Q3 优雅中断答对；入口A 已讲：7 种刹车互补清单、滑动窗口/观察去重/软硬两级循环检测、agent-evaluation 桥接；入口A 小检两题全对（窗口周期对齐、软硬两级+上报用户）
  - 入口B 已讲并闭环：窗口≠记忆、短期/长期分层、三大策略（截断/压缩/检索）；小检 3/4 全对（/compact=压缩保大意丢细节；截断丢首轮约束→压缩缓解+约束应进 system prompt）
- 🔵 **Agent 记忆系统** (in progress)
  - 短期：会话历史
  - 长期：压缩摘要与持久化
  - 已讲：记忆生命周期（写→存→检→注）；三类记忆 episodic/semantic/procedural；写策略（会话末 LLM 提炼）与注入克制（top-k）；四大坑（写噪/过期覆盖/检索错配/隐私）；最小记忆插件骨架代码（buildMessages + distill）
  - 问答反馈：三题全对；Q2 追问'覆盖决策是否交给模型'获澄清——记忆管理即工具调用（add/update/delete/search，MemGPT 模式）+ semantic 当前值/episodic 历史分层；入口A 已讲：embedding 原理、向量检索流程（同模型铁律）、chunking、zod 桥接 structured-output、检索错配三缓解
  - 入口A 小检已闭环：检1 方向对（补锐：不同模型=不同坐标系，相似度是无意义噪声，换版本同样破坏需重嵌入迁移）；检2 一半对（换非向量/关键词检索有效；'压缩'混淆检/注阶段——失败在检，压缩作用在注；已列全方案：查询改写/混合检索/元数据过滤/时间加权/rerank/条目粒度）。入口A 关闭
- 🔵 **MCP 模型上下文协议** (in progress)
  - MCP server / client 角色
  - tools / resources / prompts 三类能力
  - 已讲：N×M→M+N（USB-C/LSP 类比）；host 内嵌 client，server 独立进程（stdio/Streamable HTTP，JSON-RPC 2.0）；三类能力按控制权分：tools（模型控）/resources（应用控）/prompts（用户控）；不替代 tool calling——四步回合不变，只标准化 tools 清单的发现与接入；最小 server 示例（zod schema → tools 清单 → 原生回合执行）
  - 问答反馈（2026-11-25）：Q1 对（四步回合不变，区别是工具在 server 进程）；Q2 分类全对（控制权归属未复述已补）；Q3 方向对（三方服务→MCP 优先复用现成生态；本地简单读→原生插件）——判断轴锐化为'复用范围×集成深度'，补隔离性维度。0.25→0.35
  - 入口A 已讲：JSON-RPC 2.0 三消息型（请求/响应/通知，无 id=通知）、错误双轨制（协议错误走 error / 工具执行错误走 result.isError=true——错误即观察的协议化）、initialize 能力协商、stdio vs Streamable HTTP 对比、反向能力 sampling/roots/elicitation
  - 入口A 小检（2026-11-25）：检1 对（无 id=通知，补：重新 tools/list 刷新清单）；检2 错——误认为工具执行错误应走 JSON-RPC error，已纠偏（应走 result.isError=true，模型才能把错误当观察决策）；追问轮学习者提出有力异议（isError 需 host 主动解析否则被当成功）——澄清：这正是 MCP 规范对 host 的强制要求，且协议成功≠业务成功、悬挂 tool\_call 论证（传输层无论什么格式模型最终只收文本观察，isError 只是标准化 host 翻译）；复检：b 对（执行错误）、a 纠偏（拼错工具名=协议错误，规范列于 Protocol Errors），复检2 核心对（isError+错误文本，结构需完整）；入口B 已讲并闭环：威胁模型、三攻击面（tool poisoning/间接注入/confused deputy）、四防线（审批流/最小权限/上下文卫生/审计）；检3 全对（'schema 污染'造词传神）；检4 良好（预检 schema/检 result/权限管理/全局兜底，补固定版本防 rug pull+审计日志）。入口A/B 关闭，0.35→0.4（confidence 字段订正：实际 0.25→0.4）
- 🔵 **多智能体编排** (in progress)
  - 主 agent 与 subagent
  - pipeline / parallel 编排模式
  - 已讲（经 mcp 入口 C 展开）：多智能体=用组织分工解决上下文装不下与注意力稀释；subagent=被封装成工具的完整 loop（独立 messages，结果只回传摘要）；编排拓扑 pipeline/parallel/orchestrator（Dify 静态图 vs 动态分派主线呼应）；上下文经济（主上下文 O(1) 增摘要，代价 handoff 损耗）；拆/不拆判断（独立可并行/工具域过大/需隔离→拆；强串行/上下文小→不拆）
  - 问答反馈（2026-11-26）：Q1 错——把'主上下文省'答成'总 token 省'，已纠偏（判别式：主 agent 上下文✅省，系统总账单❌通常涨——每个子 agent 自带 system+tools 简报，固定开销×N；多智能体买的是专注/隔离/并行墙钟时间不是 token 折扣）；Q2 对（主→子→主 ≈ 模型→tool→模型）；Q3 超预期（模块解耦→并行拆理解；理解→重构强依赖→不拆；补：综合建议适合主 agent 亲自做）。0.25→0.3
  - 入口A 已讲：handoff 报告 schema（status 显式化/大产物落盘留引用/openQuestions/统计）、信息带宽权衡（瘦→幻觉补全，胖→隔离失效）、黑板模式 vs 纯消息传递（函数调用 vs 全局变量；props/emit vs 直改 store）；小检 1/2 待答
- ⚪ **Agent 评估与调试** (unexplored)
  - 会话日志与轨迹回放
  - 回归测试与评估集

## Cordis 插件框架（DSH 底层）

- ⚪ **Context 与插件模型** (unexplored)
  - 插件即函数（ctx => 回调）
  - 根 Context 与 Loader
  - @deepseek-ai/cordis 4.1.0
- ⚪ **生命周期与 effect** (unexplored)
  - start / ready / dispose
  - ctx.effect 注册自动回收
- ⚪ **服务与依赖注入** (unexplored)
  - ctx.service 暴露能力
  - inject 声明依赖
  - declare module 声明合并补类型
- ⚪ **事件系统** (unexplored)
  - 类型化事件
  - broadcast 与 waterfall 短路
- ⚪ **插件配置与 Schema** (unexplored)
  - Schema<Config> 校验
  - cordis.yml 配置读取与报错
- ⚪ **插件组合与热重载** (unexplored)
  - cordis.yml 即插件树
  - HMR 热重载与排障

## TypeScript 工程补强（前端→后端）

- ⚪ **Node.js 异步与子进程** (unexplored)
  - EventEmitter 与事件模式
  - child\_process 执行外部命令
  - Stream 与 SSE 流式响应
- ⚪ **TS 进阶类型** (unexplored)
  - 泛型与条件类型
  - declare module 声明合并
  - ESM（type: module）与 tsx
- ⚪ **pnpm Monorepo 工程** (unexplored)
  - workspace 与 filter
  - vendor 本地依赖（DSH 的 vendor/cordis 模式）
- ⚪ **测试与调试** (unexplored)
  - vitest 单测
  - 插件行为的可测试设计

## DSH Harness 平台实战

- ⚪ **第一个 Harness 插件** (unexplored)
  - cordis.yml 加载机制
  - Web UI 驱动 vs 启动器驱动
- ⚪ **开发 Tool（模型可调用能力）** (unexplored)
  - 在 harness 服务上注册工具
  - 工具 schema 与权限边界
- ⚪ **LLM 适配器开发** (unexplored)
  - 适配不同模型供应商
  - 能力的三层拆分模式
- ⚪ **插件打包安装与持久化** (unexplored)
  - 打包与安装流程
  - 持久化 Harness 插件（dynamic-cordis）
- ⚪ **场景平台架构设计** (unexplored)
  - 固定场景的需求拆解
  - 核心平台 vs 业务插件分层
