# Vibe Copilot — Agentic Product Decision OS

> **面向面试的产品级 React 全栈项目**  
> 通过多 Agent 图工作流，把模糊产品想法转化为可开发、可评分、可修复、可交给 Codex / Claude Code / Cursor 执行的 DEV_SPEC。

---

## 🚀 V4.3 Real Agent Runtime Wiring Patch

V4.3 fixes the critical gap: **the agent-v4 runtime now actually calls the LLM**.

### What changed:
- **AI Agent Call** — Normal intents trigger `callCopilotJson` with full product context and structured system prompt.
- **ai_call_started / ai_call_completed / ai_call_failed events** — Every AI call is logged in the event stream.
- **Conversation visibility** — AI call status shown as light indicators (`AI →` / `AI ✓` / `AI ✗`) in the main chat.
- **Graceful fallback** — If AI fails or is not configured, local business nodes execute as before.
- **Event Timeline enhancement** — AI events, slot events, and phase events now have distinct colors and labels.

**Verification**: Check Event Timeline or conversation — if `ai_call_started` and `ai_call_completed` appear, the Agent is genuinely calling the LLM.

### V4.3 Tech
- `src/agent-v4/graphRuntime.ts` — `attemptAIAgentCall()` function with context builder + callCopilotJson integration
- `src/agent-v4/types.ts` — Added `ai_call_started`, `ai_call_completed`, `ai_call_failed` event types
- `src/agent-v4/ui/AgentEventTimeline.tsx` — Updated color/label map for AI + slot events
- `src/pages/AgentWorkspacePageV4.tsx` — AI events visible in conversation

---

## 🚀 V4.4 API Required Runtime Lock

V4.4 is a **breaking change** that removes all local-rule and mock fallback paths. Vibe Copilot is no longer a demo that can run offline — it requires a genuine LLM API connection.

### What changed:
- **API Health System** — `src/api/apiHealth.ts` tracks readiness: unknown/not_configured/connection_failed/json_failed/validation_failed/ready.
- **ApiRequiredGate** — Blocks pages that need API when health is not `ready`. Shows clear status card with navigation to Settings.
- **All mock fallbacks removed** — `ENABLE_MOCK_FALLBACK` permanently disabled. `evaluateStep`, `explainSuggestion`, `suggestStage`, `suggestIdeaDiagnosis` no longer fall back to mock.
- **All local-rule fallbacks removed** — `buildLocalMvpSuggestions` no longer used as catch fallback. `buildLocalHandoff` no longer used as catch fallback. `handleAIFallback` removed from agent-v3.
- **Agent Runtime gated** — Both `agent-v3/runtime.ts` and `agent-v4/graphRuntime.ts` now call `assertApiReady()` before any AI turn. AI failure → `status='failed'`, no phase advancement.
- **Handoff requires AI** — `optimizeHandoff` no longer falls back to `buildLocalHandoff`. Developer handoff page only generates via AI.
- **Cleaner OutputSource** — New messages use only `'ai'` or `'error'`. Legacy `'local-rule'` and `'mock'` kept for historical data display.

### Verification
Check Event Timeline or conversation — if `ai_call_started` and `ai_call_completed` appear, the Agent is genuinely calling the LLM. If API is not ready, the page shows a clear blocking gate.

**Product positioning**: "V4.4 之后，Vibe Copilot 不再是可离线运行的 demo，而是一个必须连接真实大模型 API 的 Agent 工作流产品。"

### V4.4 Tech
- `src/api/apiHealth.ts` — Health state tracking + `assertApiReady()`
- `src/components/ApiRequiredGate.tsx` — API readiness gate component
- `src/api/evaluate.ts` — All fallbacks removed, `ENABLE_MOCK_FALLBACK = false`
- `src/agent-v4/graphRuntime.ts` — `assertApiReady()` at entry, AI failure → failed
- `src/agent-v3/runtime.ts` — `assertApiReady()` at entry, `handleAIFallback` removed
- `src/pages/MvpScopePage.tsx` — Local draft auto-fill removed, catch fallback removed
- `src/pages/DeveloperHandoffPage.tsx` — Local handoff fallback removed
- `src/pages/AgentWorkspacePage.tsx` — Local handoff fallback removed

---

## 🚀 V4.3 Real Agent Runtime Wiring Patch

V4.2 eliminates the "blank waiting" experience. Users now see immediate Agent acknowledgement the moment they send a message.

### Key changes:
- **Turn Lifecycle** — Tracks agent activity in real time: received → understanding → checking_context → running_node → completed.
- **Immediate Agent Reply** — Agent responds in < 100ms with context-aware acknowledgement (no API call).
- **Progress Indicator** — Shows step-by-step progress during runtime execution.
- **Thinking Bubble** — Displays immediate reply with animated dots while Agent works.
- **onProgress Callback** — Runtime emits progress events for UI to consume.
- **Action Card Instant Feedback** — Every action card click produces an immediate reply before execution.
- **Slow Hint** — After 8 seconds, agent updates: "这一步分析稍慢，我还在处理。"
- **Cancel Button** — Users can stop waiting and continue with local rules.
- **Clean Conversation** — Debug events (node_started, tool_called, checkpoint) are filtered to Debug tab only.

**Product positioning**: "Agent 不是等模型返回后才说话，而是像真人协作一样，先确认、再分析、再行动、再交付。"

### V4.2 Tech
- `src/agent-v4/turnLifecycle.ts` — Turn lifecycle tracking
- `src/agent-v4/immediateReply.ts` — Instant reply generator
- `src/agent-v4/ui/AgentProgressIndicator.tsx` — Progress steps UI
- `src/agent-v4/ui/AgentThinkingBubble.tsx` — Thinking bubble UI
- `src/agent-v4/graphRuntime.ts` — Added onProgress callback

---

## 🚀 V4.1 Agent Interaction & Anti-Loop Upgrade

V4.1 fixes the core Agent interaction loop problem: **the Agent no longer asks the same question repeatedly**.

### Key changes:
- **Slot Filling State** — Tracks every info gap (targetUser, scenario, coreProblem, etc.) with askedCount/status.
- **Ask-Once Protocol** — Same slot asked >= 2 times → auto-assume instead of re-asking.
- **Question Ledger** — Prevents duplicate questions; records every question asked.
- **Intent Priority** — continue/skip/make_assumption **always override** field-checking logic.
- **Default Assumptions** — Keyword-based rule engine fills missing slots with low-confidence guesses.
- **Anti-Loop** — If the same slots are missing after being asked twice, the system auto-assumes and advances.
- **Slot Panel** — New Decision OS tab showing all info slots with status (✓ known / ◎ assumed / → skipped / ? missing).
- **Abridged Agent Messages** — Agent responds concisely: "这个想法可以继续，现在还缺 X。补充或用默认假设推进。"

### V4.1 Tech
- `src/agent-v4/slotFilling.ts` — SlotFillingState, derive/ask/assume/skip operations
- `src/agent-v4/questionLedger.ts` — Prevents duplicate questions
- `src/agent-v4/defaultAssumptions.ts` — Rule-based assumption generation
- `src/agent-v4/graphRuntime.ts` — Rewritten runtime with intent-prioritized execution
- `src/agent-v4/nodes/intakeNode.ts` — Slot-aware questioning
- `src/agent-v4/ui/AgentSlotPanel.tsx` — Slot status visualization

**Product positioning**: "Vibe Copilot 的 Agent 模式不是无限聊天，而是一个可推进、可中断、可恢复的产品决策工作流。"

---

## 🚀 V4.0 Agent Graph Runtime & Decision OS

Vibe Copilot V4.0 将 Agent Workspace 从"对话页面 + Agent 状态"升级为真正的 **Agent Graph Runtime**：

### 新增核心能力

- **Agent Graph Runtime** (`src/agent-v4/graphRuntime.ts`) — LangGraph-inspired 状态图执行引擎
- **Graph Nodes** — 10 个专职节点 (orchestrator/intake/demand/product/mvp/tech/risk/handoff/reviewer/reflection)，每个节点输出 commands + findings
- **AgentGraphSession** — State/Events/Checkpoints 三位一体的持久化 session
- **Event Log** — 全事件流覆盖（node_started/completed, tool_called/completed, human_interrupt, evaluation, reflection, error）
- **Checkpoint Store** — 每次节点转换自动创建 checkpoint，支持 Time Travel 恢复
- **Tool Registry** — 11 个 Agent Tool（updateBriefStage, createFinding, createTask, generateHandoff, evaluateHandoff, createMemory, createSkill, askUser...）
- **Memory System** — 四层记忆：Working（会话变量）、Episodic（关键事件/反思）、Semantic（知识库引用）、Skill Library（可复用流程模板）
- **Reflection Node** — 从失败、评分和用户反馈中生成反思记忆和可复用 skill
- **Human-in-the-Loop** — AgentInterruptCard + pendingQuestions，等待用户确认
- **Decision OS Panel** — 右侧多 Tab 面板：State/Tasks/Findings/Memory/Skills/Debug
- **Agent Graph Panel** — 节点流程图，当前节点高亮、已完成/被跳过节点可视化
- **Event Timeline** — 最近 30 个事件的实时流
- **Task Board** — 任务管理（todo/doing/blocked/done/skipped）
- **MCP-like Tool Adapter** — 内部工具格式对齐 MCP 思想，为未来 MCP Server 预留
- **Regression Cases** — 4 组回归测试用例验证 Agent 工作流

### 参考架构

- **LangGraph**: stateful graph, durable execution, checkpoints, human-in-the-loop
- **AutoGen**: event-driven multi-agent runtime
- **CrewAI**: agents, tasks, flows, guardrails
- **MCP**: tools, resources, prompts for future compatibility
- **ReAct**: reason + act — 不只是聊天
- **Reflexion**: 从失败中生成反思记忆
- **Voyager**: skill library 沉淀

### Why this is not just a chatbot

V1 是结构化 AI 生成器，V2/V3 是 Agent Workspace，**V4 升级为 Agent Graph Runtime**。它不是只返回文本，而是维护 state、events、commands、tools、tasks、findings、memory 和 checkpoints，把自然语言交互转化为可观察、可恢复、可评估的产品决策工作流。

---

## 🎯 一句话定位

Vibe Copilot 是一个 **AI 驱动的前置产品构思工具**。它不生成代码，而是在开发者把想法交给 Codex / Claude Code / Cursor 之前，先完成需求诊断、MVP 收敛、技术决策和开发交付——四步把"我想做一个 XX"变成可以交给 AI 编程工具直接执行的 Development Prompt。

---

## 🧠 为什么做这个项目

**真实问题**：AI Coding 失败往往不是因为模型不会写代码，而是前置产品规格不清楚——目标用户、MVP 范围、数据模型、验收标准和开发约束都不明确。

**解决方案**：Vibe Copilot 用结构化决策流程替代直觉式 prompt 拼接，让 AI 先发散、推理和做默认假设，用户只确认最核心的产品决策。

**工程挑战**：
- 如何让 LLM 输出稳定可靠的结构化 JSON？
- 如何在 localStorage-only 架构下做 knowledge-retrieval + evaluation + trace？
- 如何在 API 不可用时优雅降级而不阻断用户流程？
- 如何把 8 个 AI 阶段的错误分类为 6 种可操作的诊断类型？

---

## 🏗️ 项目架构

```
vibe-copilot/
├── api/
│   └── ai-proxy.ts                 # Vercel Edge Function / Vite dev proxy
│                                     OpenAI-compatible API 同源转发
├── src/
│   ├── api/
│   │   └── evaluate.ts             # 核心 AI 集成层 (2100+ 行)
│   │                                ├── AI 配置管理 & 连接状态
│   │                                ├── VibeAIError 错误分类系统
│   │                                ├── 8 策略 JSON 修复管线
│   │                                ├── 加权引用校验 (validateAIOutputReferencesInput)
│   │                                ├── LRU AI 响应缓存
│   │                                ├── 指数退避重试 + 网络错误分类
│   │                                └── suggestStage / suggestIdeaDiagnosis / optimizeHandoff
│   │
│   ├── prompts/                     # LLM Prompt 工程
│   │   ├── suggestStagePrompt.ts    # 通用阶段 prompt
│   │   ├── mvpScopePrompt.ts        # MVP 轻量 prompt (V1.7)
│   │   ├── stageContext.ts          # 按阶段压缩上下文 (V1.7)
│   │   ├── optimizeHandoffPrompt.ts # Handoff 优化 prompt (含 referenceEvidence)
│   │   └── explainSuggestionPrompt.ts # 建议解释 prompt
│   │
│   ├── knowledge/                   # 轻量知识库 (Pseudo-RAG, 无向量)
│   │   ├── docs.ts                  # 内置案例、PRD 模板、架构模板
│   │   ├── retrieveKnowledge.ts     # 规则匹配检索 + aliases + use cases
│   │   ├── templates/
│   │   │   ├── devSpecTemplate.ts   # DEV_SPEC 模板
│   │   │   └── codexPromptTemplate.ts # Codex Execution Wrapper
│   │   └── types.ts
│   │
│   ├── evaluation/                  # 本地规则评估引擎
│   │   ├── evaluateHandoff.ts       # 5 维度评分 (加权)
│   │   └── applyHandoffFixes.ts     # 自动修复 → 再评分闭环
│   │
│   ├── spec/                        # 结构化 DEV_SPEC
│   │   ├── buildStructuredDevSpec.ts
│   │   ├── formatStructuredDevSpecMarkdown.ts
│   │   └── types.ts
│   │
│   ├── trace/                       # 生成追溯
│   │   ├── traceStore.ts            # localStorage 持久化
│   │   └── types.ts                 # HandoffTrace (score delta, fix tracking)
│   │
│   ├── snapshot/                    # 版本快照 (V1.5)
│   │   ├── snapshotStore.ts
│   │   ├── compareSnapshots.ts      # 质量变化对比
│   │   └── types.ts
│   │
│   ├── export/                      # 案例导出 (V1.5)
│   │   └── buildCaseStudyMarkdown.ts
│   │
│   ├── quality/                     # 检索自检
│   │   ├── runRetrievalSelfCheck.ts
│   │   └── sampleIdeas.ts
│   │
│   ├── rules/                       # 业务规则
│   │   └── coreDecisionExtractor.ts
│   │
│   ├── skill/                       # 产品构思规则 & 质量门
│   │   ├── systemRules.ts
│   │   ├── qualityGates.ts
│   │   └── examples.ts
│   │
│   ├── hooks/
│   │   └── useProductBrief.ts       # 状态管理 + Schema Migration
│   │
│   ├── pages/ (14 pages)
│   │   ├── LandingPage + NewIdeaPage# 入口
│   │   ├── DemandDiscoveryPage      # 第1关：需求诊断
│   │   ├── ProductFramingPage       # 产品定义
│   │   ├── BusinessFramingPage      # 业务推理
│   │   ├── MvpScopePage             # 第2关：MVP 决策
│   │   ├── TechnicalPlanningPage    # 第3关：技术决策
│   │   ├── BlindSpotReviewPage      # 盲点审查
│   │   ├── DeveloperHandoffPage     # 第4关：开发交付
│   │   ├── SettingsPage             # AI 配置 + 诊断测试
│   │   └── HistoryPage / GuidePage / OutputPage / PreviewPage
│   │
│   ├── components/
│   │   ├── StageLayout.tsx          # 标准关卡布局
│   │   ├── DecisionCard.tsx         # 核心决策卡片
│   │   ├── SuggestionCard.tsx       # 详情建议卡片
│   │   ├── GlossaryHelp.tsx         # 术语解释
│   │   └── ScopeCreepWarning.tsx
│   │
│   ├── lib/utils.ts                 # toDisplayText / toDisplayList / cn
│   ├── types.ts                     # 类型定义 (300+ 行)
│   ├── main.tsx                     # React 18 createRoot entry
│   └── App.tsx                      # Router + ErrorBoundary
│
├── vercel.json                      # SPA + API 路由规则
├── vite.config.ts                   # localAiProxy middleware
├── eslint.config.js
└── package.json
```

---

## 🔄 四阶段流程

| 阶段 | 页面 | 核心问题 | AI 产出 | 用户决策 |
|------|------|---------|---------|---------|
| **Idea Diagnosis** | DemandDiscovery + Product + Business | 这个需求值得做吗？ | 需求证据、目标用户、产品一句话、价值假设、ROI 判断 | 确认/否定产品方向 |
| **MVP Decision** | MvpScopePage | 第一版只验证哪个闭环？ | Must Have、Should Have、Out of Scope、最小闭环、范围膨胀风险 | 压缩 V1 范围 |
| **Tech Decision** | TechnicalPlanning | 最低成本技术方案是什么？ | 前端/后端/数据库/AI API 推荐、Mock 策略、技术翻译、升级条件 | 确认技术路线 |
| **Developer Handoff** | DeveloperHandoff | 是否可以交给 AI 编程工具？ | Product Brief、MVP Scope、DEV_SPEC、技术架构、数据结构、验收标准、Development Prompt + Evaluation Report | 接受/优化/修复 |

## V2.0 Agentic Workflow Refactor

### 核心理念

V1 是**结构化 AI 生成器** —— 用户进入页面 → 点击生成 → 调用 API → 返回结构化建议 → 用户接受或编辑。

V2 升级为 **Agentic Workflow** —— 系统不再只是回答用户问题，而是根据当前信息状态主动判断、追问、推进和沉淀交付物。

### 新增模块

| 模块 | 路径 | 职责 |
|------|------|------|
| Agent Types | `src/agent/types.ts` | AgentRole、AgentDecisionStatus、WorkflowPhase、AgentMessage、AgentFinding |
| Workflow Store | `src/agent/workflowStore.ts` | localStorage 持久化的 AgentWorkflow CRUD |
| Orchestrator | `src/agent/orchestrator.ts` | 本地规则引擎：判断下一步 Agent 和阶段 |
| Agent Prompts | `src/agent/agentPrompts.ts` | 7 个子 Agent 的 system prompt + 用户上下文构造 |
| Agent Runner | `src/agent/runAgent.ts` | 完整 Agent 回合：orchestrator → AI (可选) → fallback → 持久化 |
| Patch Applier | `src/agent/applyAgentPatch.ts` | 将 Agent 输出应用到现有 brief.stages |
| Agent Workspace | `src/pages/AgentWorkspacePage.tsx` | 对话式 Agent 工作流界面 |

### 7 个子 Agent

| Agent | 职责 |
|-------|------|
| orchestrator | 编排：判断当前该做什么，决定是否追问或推进 |
| demand | 需求诊断：目标用户、场景、痛点、替代方案 |
| product | 产品定义：一句话定义、用户画像、AI 介入价值 |
| mvp | MVP 收敛：Must Have、Out of Scope、Minimum Loop |
| tech | 技术决策：最小成本技术方案、Mock 策略、升级条件 |
| risk | 风险审查：需求风险、业务风险、技术风险、范围风险 |
| handoff | 开发交付：整合所有阶段的 Product Brief、DEV_SPEC、Codex Prompt |

### 关键设计

- **Agent 会主动判断是否需要追问**：如果 targetUser/scenario/problem 缺失，Agent 不会直接生成方案，而是先追问
- **AI 失败时使用 local orchestrator fallback**：不阻断对话流程，明确标注降级原因
- **保留 legacy 四步流程**：`/discovery/:id` → `/product/:id` → ... 传统流程完整保留，`/agent/:id` 为新增入口
- **状态持久化**：Workflow 状态（messages、findings、phase）保存在 localStorage，刷新不丢失

### 入口

创建产品想法后，用户可选择：
1. **进入 Agent 工作流**（新）— 对话式协作，Agent 主动推进
2. **进入四步流程**（旧）— 传统表单式流程

---

## V2.1 Agent Workflow Continuity Patch

### 修复内容

- HistoryPage 现在检测 Agent workflow 记录，支持从历史恢复 Agent 对话
- Agent 和 Legacy 四步流程页面可双向跳转
- Orchestrator 以 workflow.currentPhase 为核心状态机，不再被缺失字段随意拉回早期阶段
- continue / skip / make_assumption 意图不再被 need_more_info 拦截
- questions 改为结构化数据传递（AgentTurnResult.questions），不再靠解析 reply 文本中的 "·"
- AgentWorkspacePage 不再重复渲染 reply pending bubble（workflow.messages 是单一数据源）
- 删除项目时同步清理 Agent workflow，避免 orphan 记录
- 新增 phaseUtils.ts 统一 phase 推进逻辑和中文标签

### 新增/修改文件

| 文件 | 变更 |
|------|------|
| `src/agent/phaseUtils.ts` | 新增：getNextPhase / getPreviousPhase / getPhaseLabel |
| `src/agent/workflowStore.ts` | 新增：listAgentWorkflows / deleteAgentWorkflow / getAgentWorkflowSummary |
| `src/agent/orchestrator.ts` | 重写：intent 优先 + phase 状态机 + phaseAfterTurn |
| `src/agent/runAgent.ts` | 修改：结构化 questions、phaseAfterTurn 驱动 |
| `src/pages/AgentWorkspacePage.tsx` | 重写：统一 sendAgentMessage、去重复 bubble、联动入口、Sidebar 增强 |
| `src/pages/HistoryPage.tsx` | 重写：Agent workflow 检测、恢复、删除联动 |
| `src/pages/DemandDiscoveryPage.tsx` | 修改：增加"切换到 Agent"入口 |
| `src/pages/MvpScopePage.tsx` | 修改：增加"切换到 Agent"入口 |
| `src/pages/TechnicalPlanningPage.tsx` | 修改：增加"切换到 Agent"入口 |
| `src/pages/DeveloperHandoffPage.tsx` | 修改：增加"切换到 Agent"入口 |

---

每个阶段支持 **Focus（核心决策）/ Detail（完整地图）** 双视图切换。

---

## 🧪 核心工程亮点（面试重点）

### 1. AI 错误分类系统 (V1.6)

不只是一个 catch。所有 AI 错误被分为 6 种类型，每种有独立的用户提示：

```typescript
export type AIErrorType =
  | 'connection'   // API URL/网络问题
  | 'timeout'      // 模型响应超时
  | 'http'         // 上游 API 非 2xx
  | 'empty'        // 模型返回空
  | 'json_parse'   // 无法解析为 JSON
  | 'validation'   // 输出与输入无关

class VibeAIError extends Error {
  type: AIErrorType;
  rawContent?: string;
  detail?: unknown;
}
```

前端不再显示"大模型生成失败"——根据类型分别提示网络问题、JSON 格式问题、相关性不足。

### 2. 8 策略 JSON 修复管线

LLM 输出的 JSON 经常不标准：markdown 代码块、注释、尾部逗号、花括号不闭合、被截断。项目实现了 8 层降级策略：

```
1. 直接 JSON.parse
2. 剥离 ``` 围栏后 parse
3. 花括号平衡匹配 + 剥离围栏
4. 全部修复 (注释+逗号+围栏)
5. 平衡括号 + 全部修复
6. 截断恢复 (自动补全未闭合括号)
7. 平衡匹配 + 截断恢复
8. 贪婪正则 + 修复 (最终兜底)
```

配合 `unwrapJsonPayload()` 自动剥离 `{result:{}}`, `{data:{}}`, `{output:{}}`, `{content:"{...}"}` 等常见包裹模式。

### 3. 加权引用校验

不只是检查"AI 输出里有没有用户的原始词汇"。`validateAIOutputReferencesInput()` 实现了：

- **权重系统**：rawIdea=3pts, targetUser/scenario/problem=2pts, projectType=1pt
- **多通道检查**：referenceEvidence 字段 + JSON 全文 + 长内容字段 (productBrief/devSpec)
- **自适应阈值**：`minRequired = Math.min(2, fields.length)` — 只填了 1 个字段时匹配 1 即可
- **短字段豁免**：projectType 短于 6 字符时自动放宽

### 4. MVP 快速通道 (V1.7)

第二步 MVP Decision 是超时重灾区。V1.7 做了三重优化：

- **压缩上下文**：`buildCompactStageContext('mvp')` 只传 ideaInput + productSummary + demandSummary ≤180字/字段
- **轻量 prompt**：`buildMvpScopePrompt()` 不含技术规则/质量门/翻译示例，token 预算从 1400 降到 900
- **即时可用**：进入页面即填 `buildLocalMvpSuggestions()` 本地草案，不等待 AI；用户手动点击"AI 优化"才调模型

### 5. 优雅降级 (Graceful Degradation)

MVP 阶段对 4 种 AI 失败类型做 fallback：

```
timeout / json_parse / empty / validation
    → 返回本地规则草案 (source='local-rule')
    → reason 标注失败原因
    → 用户可继续下一步，不阻断流程
```

非 MVP 阶段：json_parse 失败后自动重试 1 次（stricter prompt），再失败才抛错。

### 6. 轻量知识检索 (Pseudo-RAG)

当前不依赖向量数据库，使用规则匹配 + aliases + use cases 做可解释检索：

- 中文 aliases 映射（如"雅思"→"生词错题管理"）
- 返回 score、matched aliases、matched tags、matched fields、引用 reason
- Knowledge References 展示"为什么引用这份知识、影响哪些输出区块"

### 7. SPEC Quality Loop (V1.3-V1.5)

形成"生成 → 评分 → 修复 → 再评分"闭环：

```
Handoff 生成
  → Evaluation (5维度加权评分)
  → Fix Suggestions (可执行 patch)
  → Apply Local Fixes (自动追加到对应区块)
  → Re-evaluate (score delta 追踪)
  → Snapshot 对比 (V1.5)
  → Case Study 导出 (V1.5)
```

### 8. 缓存与幂等性

- **Prompt-aware cache key**：`stage + briefId + model + hash(systemPrompt) + hash(userContent)` — 修改 prompt 自动失效
- **配置变更清空缓存**：Settings 保存时调用 `clearAICache()`
- **MVP cache 隔离**：`stage:mvp:fast` 避免命中旧版缓存

### 9. 代理层动态超时

`api/ai-proxy.ts` (Vercel Edge) 和 `vite.config.ts` (本地开发) 统一处理：

```typescript
function normalizeTimeoutMs(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 90000;
  return Math.min(Math.max(n, 10000), 240000); // 10s ~ 240s
}
```

前端可根据任务轻重传不同 timeout：Hint 请求 60s，MVP 快速通道 75s，Handoff 180s。

### 10. Settings 诊断测试

Settings 页实现了 4 层独立诊断：

1. **API Connection**：短请求连通性
2. **JSON Parse**：复用 `extractJson()` 8 策略管线
3. **Required Fields**：`isUsefulString()` 拒绝 `"..."` / `"N/A"` / 空串
4. **Reference Validation**：复用 `validateAIOutputReferencesInput()`

不再把"模型返回省略号"误判为"API 连接成功"。

---

## 📊 技术栈

| 层次 | 技术 |
|------|------|
| Language | TypeScript 5 |
| UI Framework | React 19 + Vite 8 |
| Styling | Tailwind CSS v4 + 自定义 CSS Components |
| Routing | React Router v6 |
| State | React Context + localStorage + useProductBrief Hook |
| API Integration | OpenAI-compatible (同源代理转发) |
| Proxy | Vercel Edge Function + Vite dev middleware |
| Icons | lucide-react |
| Linting | ESLint + prefer-const |

---

## 🚀 快速开始

```bash
# 安装
npm install

# 开发
npm run dev        # → http://localhost:5173

# 构建
npm run build      # → dist/

# Lint
npm run lint       # 0 errors
```

### 配置 AI

1. 打开应用 → 右上角齿轮 → AI 设置
2. 填入 OpenAI-compatible API URL / Key / Model
3. 先跑 **测试连接（短）** → 再跑 **测试长 JSON 生成**
4. 四层全部通过后即可使用

---

## 📁 项目统计

```
57+ 源文件 (33+ TypeScript + 21+ TSX + 1 CSS + 1 SVG + 1 PNG)
2100+ 行评估引擎 (evaluate.ts)
7 个子 Agent (orchestrator/demand/product/mvp/tech/risk/handoff)
14+ 页面组件
6 种 AI 错误分类
8 策略 JSON 修复管线
5 维度加权评分引擎
4 阶段产品构思流程
4 层 Settings 诊断
3 种使用模式 (Beginner / Builder / Review)
```

---

## 🗣️ Portfolio Story

V1 是**结构化 AI 生成器**：用户填表 → AI 生成 → 用户确认。每个步骤都依赖用户主动触发，本质上是一个"AI 驱动的精美表单"。

V2 升级为 **Agentic Workflow**：系统不再只是回答用户问题，而是根据当前信息状态主动判断、追问、推进和沉淀交付物。这代表了一个产品思维的跃迁 —— 从"工具"到"协作者"。

核心工程挑战：
- 如何在没有后端/数据库的情况下实现 Agent 状态机？
- 如何让 Orchestrator 在本地规则下做出可解释的路由决策？
- 如何在 AI 失败时优雅降级而不破坏 Agent 对话连续性？
- 如何让 7 个子 Agent 的 prompt 保持一致的输出格式和追问策略？

## 🗣️ 面试 Talking Points

### Q1: 这个项目的技术难点在哪里？

**A**: 最大难点是 **LLM 输出的不可靠性**。我的解决方案分四层：
1. **8 策略 JSON 修复管线** — 处理 markdown 围栏、注释、尾部逗号、截断、嵌套包裹
2. **6 类 VibeAIError** — 不给用户看"大模型失败"，而是精确到 connection/timeout/json_parse/validation
3. **加权引用校验** — 不只检查关键词出现，还检查 referenceEvidence、长内容字段、片段命中
4. **优雅降级** — MVP 阶段 4 种 AI 失败都 fallback 到本地草案，不阻断流程

### Q2: 为什么没接数据库/向量数据库？

**A**: 这是刻意选择。当前知识库规模小（~10 篇文档），规则匹配更可控、可解释、低成本，也更适合展示"为什么引用这份知识"。当知识库规模扩大后可接 Embedding + Rerank，但 V1 优先验证核心价值闭环。

### Q3: Evaluation 怎么设计？

**A**: 从 5 个维度评估 handoff 质量：
- User Scenario Clarity (用户场景清晰度)
- MVP Focus (MVP 聚焦度)
- Technical Executability (技术可执行性)
- Acceptance Criteria Completeness (验收完整度)
- Prompt Executability (Prompt 可执行性)

加权计算，技术可执行性和 Prompt 可执行性权重更高。每个维度输出 evidence、issues、suggestions，不只是总分。

### Q4: Apply Local Fixes 的设计思路？

**A**: 把评测建议从"自然语言建议"变成可执行 patch。每个 fix 指定 targetSection（如 productBrief/mvpScope/devSpec）和 patch 内容，用户一键追加到对应区块。配合 Generation Trace 追踪 score delta 和 fixed issue count，形成生成→评分→修复→再评分闭环。

### Q5: 缓存怎么设计？

**A**: LRU 缓存（最近 50 条），key 包含 `stage + briefId + model + hash(systemPrompt) + hash(userContent)`。修改 prompt 后自动失效。Settings 配置变更时主动清空。MVP 使用独立 cache key (`stage:mvp:fast`) 避免与旧版缓存冲突。

### Q6: 前端状态管理怎么做的？

**A**: `useProductBrief` 自定义 Hook — 读取 localStorage 时自动做 Schema Migration（normalizeBrief），把旧版数据转为最新 schema，包括 FinalHandoff 的 validationWarnings、knowledgeReferences、evaluation 等嵌套对象归一化。

### Q7: 如果面试官问"你怎么保证这个项目线上可用？"

**A**: 
- Vercel 自动部署，push 即上线
- Settings 页 4 层诊断确保 API 配置正确
- 所有 AI 调用有指数退避重试（3 次）+ 网络错误分类
- 代理层动态超时 10s-240s
- AppErrorBoundary 捕获 React 渲染崩溃（含 #31 object-as-child 保护）
- 所有动态字段用 `toDisplayText()/toDisplayList()` 归一化后才渲染

---

## 📝 版本历史

| 版本 | 核心变更 |
|------|---------|
| V1.1 | Knowledge-Enhanced Handoff + 知识库 + DEV_SPEC + Evaluation |
| V1.2 | 可解释检索 (aliases/use cases) + Knowledge References + Trace |
| V1.3 | SPEC Quality Loop + fixSuggestions + Apply Local Fixes |
| V1.4 | Schema Migration + 结构证据评分 + Retrieval Self Check |
| V1.5 | Snapshot + Quality Compare + Case Study Export + Demo Samples |
| **V1.6** | VibeAIError 分类 + 加权引用校验 + referenceEvidence + cache fix + salvage |
| **V1.7** | MVP 快速通道 (compact context + light prompt + local-rule pre-fill) |
| **Latest** | unwrapJsonPayload + 增强 JSON 诊断 + json_parse fallback + JSON retry |
| **V2.0** | Agentic Workflow Refactor — 从页面驱动升级为 Agent 状态机驱动 |
| **V2.1** | Agent Workflow Continuity Patch — 连续性修复、历史恢复、阶段推进、双向互通 |

---

## 🔮 未来路线图

- 知识库规模扩大 → 接 Embedding + Rerank (Real RAG)
- 需要被 Claude/Codex 直接调用 → 封装 MCP Server
- 需要跨设备/团队 → 接数据库 + Auth
- 已接入的 AI API → 多模型对比评测

---

## 📄 License

MIT

---

> Built with React 19, TypeScript, and a lot of debugging of LLM JSON outputs.
