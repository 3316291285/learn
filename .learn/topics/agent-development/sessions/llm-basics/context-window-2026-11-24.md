# 讲解会话：Token 与上下文窗口管理（llm-basics · context-window）

> 日期：2026-11-24 · 阶段 1 第 4 个概念 · 讲解对象：Vue3+TS 前端开发者，有 Dify 工作流经验
> 前置衔接：agent-loop 入口 B 已立骨架（窗口≠记忆、三策略）；agent-memory 入口 A 已讲向量/检索。本讲下探到 **API 层**：窗口到底怎么计量、怎么计费、怎么管理

---

## 一、定位：它是什么，为什么是基石

**上下文窗口 = 模型单次能"看见"的最大 token 数——一切记忆策略都要在这个硬约束内做文章。**

一句话记住：**窗口是物理限制（tokenizer 计量、按 token 计费），记忆系统（短期三策略/长期检索）是建立在这个限制之上的应用层策略。**

图谱位置：

```
tool-calling → agent-loop → agent-memory → mcp ...
context-window ★你在这里（姊妹概念：agent-memory 的 B 入口正式展开）
```

与已学概念的接缝：
- agent-loop：每多走一步就重发全量历史 → token 成本 O(N²)
- agent-memory：短期记忆三策略（截断/压缩/检索）全部服务于"塞进窗口"

## 二、核心机制

### 2-1 tokenizer：token 不是"字"

- 模型不认字，认 token——BPE/subword 切分出来的碎片
- 经验值：英文 ~0.75 词/token（约 4 字符）；**中文约 1 字 ≈ 1~1.5 token**（看词表，中文效率天然差一截）
- 推论：同样内容中文更费 token；估算中文按 1 字 = 1~1.5 token 预算，别按字符数

### 2-2 窗口的构成：input + output 共享一个窗口

一次请求塞进窗口的内容远不止对话：

```
[system prompt] + [tools 全部 schema] + [全部历史消息(含工具结果)] + [本次输入] + 预留 output
        └──────────────── input 共享窗口 ────────────────┘   + max_tokens(独立参数)
```

- `max_tokens`（输出上限）是**独立参数**，且 input + max_tokens ≤ 窗口，超了直接报错
- **tools schema 也占 token**——"工具不是越多越好"的第二重成本（第一重是注意力稀释）
- 工具回传的大结果（整个文件内容）是 agent 上下文膨胀的最大元凶

### 2-3 计费与 prompt caching

- 计费 = input token 单价 + output token 单价（output 通常贵数倍）
- **prompt caching（前缀缓存）**：本次请求前缀（system + tools + 早期历史）与上次完全一致 → 缓存命中部分大幅降价（DeepSeek context caching / Claude / OpenAI 都有）
- 工程推论：**system 放最前 + 内容稳定 + 历史只追加不改动**不只是好习惯，是直接省钱——agent loop 天然满足"只追加"，缓存命中率高

### 2-4 窗口管理：三策略的 API 层落地（衔接 B 入口）

| 策略 | 做法 | 代价 |
|---|---|---|
| 截断 | 保 system + 最近 N 轮 | 丢早期约束（B 入口小检已考） |
| 压缩 | 旧历史 → LLM 摘要（/compact 即此类） | 保大意丢细节 |
| 检索 | 历史/知识外置，按需注入 | 检索 miss 风险（A 入口刚讲） |

再加一条 API 层手段：**大工具结果不进历史**——写盘/摘要后只留引用（Claude Code 对长命令输出就是这么做的）。

## 三、类比锚点

- **前端**：窗口 = 一屏视口（viewport），历史 = 超长列表。截断 = 只渲染尾部；压缩 = 折叠区显示为摘要行；检索 = 搜索后跳转；prompt caching = keep-alive 组件缓存（前缀不变才命中）。
- **Dify**：应用日志里每个节点的 token 用量就是计费明细；"记忆窗口"设置 = 截断策略的可视化配置。
- **DSH**：LLM 适配器层要统一处理各模型的窗口差异（128K vs 64K），窗口管理逻辑写在适配器层而不是业务插件里。

## 四、代码示例：发送前的 token 预算检查（阅读向）

```typescript
const WINDOW = 128_000;
const OUTPUT_RESERVE = 8_000;               // max_tokens：给输出留的额度

async function sendWithBudget(messages: ChatMessage[], call: (m: ChatMessage[]) => Promise<Reply>) {
  // 1. 真实计数（用各家 tokenizer 库，不要拿字符数估）
  let tokens = countTokens(messages);
  // 2. 超预算 → 压中间、保两端：头部（system+tools，还能吃缓存）+ 最近几轮
  if (tokens + OUTPUT_RESERVE > WINDOW) {
    const [head, ...rest] = splitAtSystem(messages);      // head = system + tools
    const summary = await summarize(rest.slice(0, -4));   // 压缩旧历史，保最近 4 条
    messages = [...head, summaryMsg(summary), ...rest.slice(-4)];
  }
  return call(messages);
}
```

两个设计决策：
1. **压中间、保两端**——system（约束）和最近几轮（当前任务）价值密度最高。
2. **计数用真 tokenizer**——字符数估算在中文场景误差可达 50%。

## 五、常见误区

1. **"窗口 128K，我这才 3K，永远不用管"** —— 错两层：agent loop 里历史按步累积（O(N²)），工具回传大结果一次就能吃掉几十 K；且长窗口有 lost-in-the-middle（中部注意力弱），塞得下 ≠ 用得好。
2. **"1 个汉字 = 1 个 token"** —— 中文通常 1~1.5 token/字，按 1:1 估算会系统性低估。
3. **"max_tokens 就是上下文窗口"** —— 它只是输出上限；input + max_tokens 共享窗口。

## 六、苏格拉底自检（开放式纯问答）

**Q1（判断）**："我的会话才 3K token，窗口 128K，所以这个应用完全不用考虑窗口管理。"——对吗？

**Q2（机制）**：为什么"system prompt 放在最前且内容保持稳定"不只是编码习惯，还有直接的经济收益？这依赖模型的什么机制？

**Q3（估算应用）**：记忆库要注入 20 条记忆，每条约 200 个汉字。粗算这批注入占多少 token？占 128K 窗口的比例大约多少？由此对"注入克制"有什么量化认识？

---

## 苏格拉底问答记录（学习者作答 · 2026-11-25）

**Q1 ✅ 正确**：不对——O(N²) 累加很容易超 128K，必须考虑。补全：单步工具回传大结果也能一次吃掉几十 K；长窗口还有 lost-in-the-middle，塞得下 ≠ 用得好。

**Q2 ⚠️ 方向沾边，机制未答到**：答"模型先收集足够上下文缓存再分析 content"——正确机制见下方 Q2 补讲。核心缺口：缓存方是**推理服务**不是模型自己；命中条件是**前缀逐 token 精确一致**；经济收益来自**缓存命中的计费折扣**。

**Q3 ✅ 正确**：200×1.5×20 = 6000 token，6000/128K ≈ 4.7%；结论"提炼关键大意、不完整存储"正确。补充量化感受：单次注入 5% 不大，但每次请求都重复付这 6000 token，且 loop 内每步都带——克制注入既省窗口也省钱；20 条其实已偏多，生产 top-k 常取 3–5。

**置信度**：0.25 → 0.3。

## Q2 补讲：prompt caching 的真实机制

1. **谁在缓存**：推理服务（API 提供方），不是模型"决定"去缓存。缓存的是前缀 token 的**注意力中间计算结果（KV cache）**——处理新内容时直接复用，不用重算整个前缀。
2. **命中条件（铁律）**：本次请求与上次请求的**开头部分逐 token 完全一致**才算命中；前缀中任何位置变动一个 token，其后全部失效重算。所以"system 放最前且稳定"是硬要求——system 若带时间戳等动态内容，每次都变，缓存永远 miss。
3. **为什么 agent loop 天然受益**：历史消息只追加不改动 → 前缀每次都一样，只有末尾新增 → 步步命中。
4. **经济收益**：缓存命中部分按大幅折扣计费（Claude 缓存读取约 0.1 倍、OpenAI 约 5 折、DeepSeek 命中价也远低于未命中），同时首 token 延迟显著降低——**又省钱又快**。

## 七、递归入口

- **A. tokenizer 深挖**：BPE 切分原理、为什么中英文 token 效率不同、tiktoken 实测
- **B. prompt caching 深挖**：前缀命中规则、缓存 TTL、DeepSeek context caching 计费细节
- **C. 主线**：回到 agent-memory 入口 C → 图谱顺序下一个概念 `mcp` 正式讲

## 讲解小结

- 窗口是物理约束：input（system+tools+历史+输入）与 output（max_tokens）共享窗口。
- token ≠ 字：中文 1 字 ≈ 1~1.5 token；计费 input/output 分开，output 更贵。
- prompt caching 奖励"前缀稳定只追加"——agent loop 天然受益。
- 窗口管理 = 三策略落地 + 大工具结果不进历史；压中间、保两端。
