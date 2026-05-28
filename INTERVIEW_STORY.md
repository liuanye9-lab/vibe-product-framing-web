# Vibe Decision Copilot — 面试讲述材料

> 用于 AI 产品实习 / 应用岗位面试的作品集展示

---

## 项目概述（2 分钟版本）

### 一句话
**把模糊产品想法转化为 Codex 可执行任务包的前期决策 Agent。**

### 背景问题
Vibe Coding 失败的本质往往不是 AI 不会写代码，而是：
> 用户在没有想清楚"做什么、为什么做、给谁做、做到什么程度算完成"的情况下，就让 AI 开始写代码。

### 解决方案
在 AI 写代码之前，先把模糊想法走完 10 个决策阶段，最终输出 DEV_SPEC 和 CODEX_TASK_PACK，让 coding agent 可以基于清晰的规格执行。

---

## 技术深度（3 分钟版本）

### 1. 架构设计

**10 阶段决策闭环**：
```
Raw Idea → Problem Framing → User Scenario → Demand Evidence
→ MVP Scope → Risk Counterargument → Tech Constraints
→ Acceptance Criteria → DEV_SPEC → CODEX_TASK_PACK
```

每个阶段有独立的状态追踪、质量评分、缺失信息检测和确认节点。

**设计理念来源**：
- **github/spec-kit** 的四阶段流水线（Specify → Plan → Tasks → Implement）
- **MetaGPT** 的 SOP 理念（Code = SOP(Team)）
- **LangGraph** 的有状态图执行 + Human-in-the-Loop
- **EARS Syntax** 的 5 种结构化需求模板

### 2. 需求质量评分

自研的 8 维度评分框架，不依赖 AI API：
- **Clarity**（清晰度）：是否说清楚要做什么
- **Specificity**（具体性）：是否包含具体数字/场景
- **User Evidence**（用户证据）：是否有用户/需求证据
- **Scope Control**（范围控制）：P0/P1/P2 是否明确
- **Testability**（可测试性）：验收标准是否可执行
- **Technical Feasibility**（技术可行性）：是否定义技术约束
- **Risk Awareness**（风险意识）：是否有反证和风险
- **Codex Executability**（Codex 可执行性）：能否交给 coding agent

设计思路：
- P0 先用本地规则（基于长度/结构/关键词的启发式评分）
- P1 升级为 LLM-as-a-Judge（AI 驱动质量评估）
- 每个维度 0-5 分，总分 40 分

### 3. 歧义检测

基于正则 + 规则的模糊表述检测：
- 模糊量词："很多"、"一些"、"大部分"
- 空洞形容词："好用"、"智能"、"强大"、"友好"
- 泛词："智能化"、"自动化"、"平台化"
- 无边界范围："所有用户"、"全平台"、"全覆盖"
- 口语化表述："做一个"、"搞一个"

每个检测附带具体的澄清追问。

### 4. CODEX_TASK_PACK 设计

参考 Codex CLI 的 AGENTS.md 机制设计：
- **Self-contained**：Codex 拿到后不需要额外澄清
- **Forbidden Changes**：明确禁止擅自添加登录/数据库/支付
- **Progress Checklist**：每个任务有明确的完成百分比
- **Codex-Ready**：结构化任务列表 + 依赖关系 + 验收标准

### 5. 向后兼容设计

- 所有新字段用 `?` 可选标记
- `normalizeBrief()` 自动补全缺失字段
- 旧 localStorage 数据不白屏
- 不修改任何 Agent V4 Runtime 代码

---

## 业务视角（1 分钟版本）

### 竞品差异化
| 竞品 | Vibe Decision Copilot 的差异 |
|------|----------------------------|
| PRD 生成器 | 不是一次性生成，是 10 阶段渐进决策 |
| 聊天式 AI 助手 | 不是自由对话，是结构化的状态机工作流 |
| 表单工具 | 不是简单填空，有评分/反证/歧义检测 |
| Coding Agent（Cursor/Claude Code） | 不做代码生成，做代码生成**之前**的工作 |

### 用户价值
- **初学者**：不知道产品开发需要想什么 → 10 阶段引导完整覆盖
- **Solo Developer**：一人需要做所有决策 → AI 辅助 + 人类确认的协作模式
- **面试者**：需要展示产品思维 → STRUCTURED DEV_SPEC + CODEX_TASK_PACK 可视化

---

## 成长路径（1 分钟版本）

### 个人故事
这个项目经历了多次迭代：
1. **V1**：简单的 10 步问卷（纯前端表单）
2. **V2/V3**：引入 AI API 调用，Agent Workspace
3. **V4**：自研 Agent V4 Graph Runtime（10 节点有状态图）
4. **V4.4**：API Required Runtime Lock，移除所有 mock 回退
5. **P0 升级**：从"10 步引导工具"升级为"Vibe Decision Copilot"

### 学到了什么
- **Spec-Driven Development**：规格说明比代码更重要
- **LLM 的局限性**：AI 需要结构化的输入，模糊想法只会得到模糊代码
- **Multi-Agent 范式**：通过研究 MetaGPT/LangGraph/AutoGen，理解了 Agent 协作的本质
- **Human-in-the-Loop**：最好的 AI 产品是 AI 辅助人类，不是替代人类

---

## 演示流程（5 分钟现场版）

### 第 1 分钟：问题 + 方案
1. 开场："你做 vibe coding 的时候，有没有发现 AI 经常生成一堆看起来好看但完全不符合需求的代码？"
2. 核心观点："问题不在 AI，在于我们没有给 AI 清晰的规格说明。"
3. 展示 LandingPage，点出 "不要把一句模糊想法直接丢给 AI 写代码" 的定位。

### 第 2-3 分钟：完整流程走查
1. 输入一个模糊想法："我想做一个 AI 客服评估系统"
2. 展示歧义检测结果（"AI 客服"是模糊词，"系统"暗示范围过大）
3. 走完 10 阶段引导流程（展示 AI 如何推理技术架构/数据模型/验收标准）
4. 展示质量评分从低到高的变化

### 第 4 分钟：核心产出
1. 打开 DecisionOutputPage
2. 展示 10 阶段进度条（可视化闭环）
3. 展示需求质量评分（8 维度分数）
4. 展示 DEV_SPEC（折叠展开各节）
5. **重点展示 CODEX_TASK_PACK**（这里和竞品的差异化最明显）

### 第 5 分钟：技术亮点 + 未来
1. "这个设计参考了 github/spec-kit 的四阶段流水线、MetaGPT 的 SOP 理念"
2. 未来方向：LLM-as-a-Judge 质量评估、多 Agent 协作
3. "这个项目还在持续迭代，我把它当作理解 AI 产品设计的实验场"

---

## 常见面试追问准备

### Q: 为什么不做代码生成？
A: "代码生成已经有 MetaGPT、OpenHands 等成熟方案。我的差异化价值在前置决策——让 spec 足够好，好到 coding agent 可以直接执行。这是一个更被忽视的环节。"

### Q: 为什么不接数据库？
A: "当前阶段验证的是产品决策方法论本身，不是技术架构的复杂度。纯前端 + localStorage 足够支撑 P0 验证。数据库是 P2 的扩展项。"

### Q: 和 Cursor/Claude Code 的关系？
A: "不是竞品，是互补。Cursor 帮用户写代码，我的工具帮用户在写代码**之前**理清需求。CODEX_TASK_PACK 可以下载后直接粘贴到 Cursor 的 chat 中作为上下文。"

### Q: 如何评估需求质量？
A: "P0 用本地规则（基于长度、结构、关键词的启发式评分）。P1 升级为 LLM-as-a-Judge。两种方式的差异在于：本地规则可解释性强但覆盖有限，LLM-as-a-Judge 覆盖广但需要校准。"
