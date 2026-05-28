# ARCHITECTURE_AUDIT.md — VibePilot 代码架构完整审计

> 审计日期：2025-05-28  
> 审计者：架构师 高见远  
> 目标：为 VibePilot → Vibe Decision Copilot 升级提供基准

---

## 1. 项目文件结构（src/ 下所有文件及职责）

```
src/
├── main.tsx                          # React 19 入口，带启动屏和降级加载
├── App.tsx                           # 路由配置 + ErrorBoundary
├── index.css                         # Tailwind CSS v4 + 设计 token 定义
├── types.ts                          # 核心类型定义 (333 行)
│
├── api/
│   ├── evaluate.ts                   # AI 集成核心 (2100+ 行) — 配置管理、调用、JSON修复、缓存
│   └── apiHealth.ts                  # V4.4 API 健康状态系统 (129 行)
│
├── hooks/
│   └── useProductBrief.ts            # 状态管理 Hook (483 行) — localStorage CRUD + Schema Migration
│
├── lib/
│   └── utils.ts                      # toDisplayText / toDisplayList / cn (Tailwind class merge)
│
├── data/
│   └── steps.ts                      # 10 步引导流程配置 (StepConfig[])
│
├── pages/                            # 14 个页面组件
│   ├── LandingPage.tsx               # 首页 — 产品定位/CTA
│   ├── NewIdeaPage.tsx               # 输入想法 — 模式选择 + 两种工作流入门
│   ├── DemandDiscoveryPage.tsx       # 第1关：需求诊断
│   ├── ProductFramingPage.tsx        # 产品定义
│   ├── BusinessFramingPage.tsx       # 业务推理
│   ├── MvpScopePage.tsx              # 第2关：MVP 范围
│   ├── TechnicalPlanningPage.tsx     # 第3关：技术方案
│   ├── BlindSpotReviewPage.tsx       # 盲点审查
│   ├── DeveloperHandoffPage.tsx      # 第4关：开发交付（核心输出页）
│   ├── OutputPage.tsx                # 开发提示词查看页 (已重定向到 handoff)
│   ├── AgentWorkspacePage.tsx        # V2/V3 Agent 工作区
│   ├── AgentWorkspacePageV4.tsx      # V4 Agent Graph 工作区（当前主力）
│   ├── HistoryPage.tsx               # 历史记录
│   └── SettingsPage.tsx              # AI 配置 + 诊断
│
├── components/                       # 共享组件
│   ├── StageLayout.tsx               # 四步流程标准布局
│   ├── DecisionCard.tsx              # 核心决策卡片
│   ├── SuggestionCard.tsx            # AI 建议详情卡片
│   ├── GlossaryHelp.tsx              # 术语解释
│   ├── ScopeCreepWarning.tsx         # 范围膨胀警告
│   └── ApiRequiredGate.tsx           # V4.4 API 就绪门控
│
├── prompts/                          # LLM Prompt 工程
│   ├── suggestStagePrompt.ts         # 通用阶段提示构建
│   ├── mvpScopePrompt.ts             # MVP 轻量提示
│   ├── stageContext.ts               # 按阶段压缩上下文
│   ├── optimizeHandoffPrompt.ts      # Handoff 优化提示
│   └── explainSuggestionPrompt.ts    # 建议解释提示
│
├── knowledge/                        # 轻量知识库 (Pseudo-RAG)
│   ├── docs.ts                       # 内置案例/模板
│   ├── retrieveKnowledge.ts          # 规则匹配检索
│   ├── rubrics/
│   │   └── handoffRubric.ts          # 交付评分标准
│   ├── templates/
│   │   ├── devSpecTemplate.ts        # DEV_SPEC 模板构建器
│   │   └── codexPromptTemplate.ts    # Codex 执行包装器
│   └── types.ts                      # 知识库类型
│
├── evaluation/                       # 本地评估引擎
│   ├── evaluateHandoff.ts            # 5 维度加权评分 (265 行)
│   └── applyHandoffFixes.ts          # 自动修复 → 再评分
│
├── spec/                             # 结构化 DEV_SPEC
│   ├── types.ts                      # StructuredDevSpec 类型
│   ├── buildStructuredDevSpec.ts     # 从 brief 构建结构化 spec
│   └── formatStructuredDevSpecMarkdown.ts # 格式化为 Markdown
│
├── trace/                            # 生成追溯
│   ├── types.ts                      # HandoffTrace 类型
│   └── traceStore.ts                 # localStorage 持久化
│
├── snapshot/                         # 版本快照
│   ├── types.ts                      # HandoffSnapshot 类型
│   ├── snapshotStore.ts              # localStorage 持久化
│   └── compareSnapshots.ts           # 质量变化对比
│
├── export/
│   └── buildCaseStudyMarkdown.ts     # 案例导出
│
├── quality/                          # 检索自检
│   ├── runRetrievalSelfCheck.ts
│   └── sampleIdeas.ts
│
├── rules/
│   └── coreDecisionExtractor.ts      # 核心决策提取
│
├── skill/                            # 产品构思规则
│   ├── systemRules.ts                # 系统规则（范围膨胀术语等）
│   ├── qualityGates.ts               # 质量门
│   └── examples.ts                   # 示例
│
├── agent/                            # V2 Agent 架构 (保留兼容)
│   ├── types.ts
│   ├── orchestrator.ts
│   ├── runAgent.ts
│   ├── agentPrompts.ts
│   ├── applyAgentPatch.ts
│   ├── workflowStore.ts
│   └── phaseUtils.ts
│
├── agent-v3/                         # V3 Agent 架构 (保留兼容)
│   ├── types.ts
│   ├── runtime.ts
│   ├── phaseMachine.ts
│   ├── contextBuilder.ts
│   ├── intentParser.ts
│   ├── agentPromptBuilder.ts
│   ├── agentContracts.ts
│   ├── toolRegistry.ts
│   ├── sessionStore.ts
│   ├── applyAgentCommandPatch.ts
│   └── migrateLegacyAgent.ts
│
├── agent-v4/                         # V4 Agent Graph Runtime (当前主力)
│   ├── types.ts                      # Agent 核心类型 (311 行)
│   ├── graph.ts                      # 状态图定义 + 转换规则
│   ├── graphRuntime.ts               # 图执行引擎
│   ├── graphStore.ts                 # localStorage 持久化
│   ├── eventLog.ts                   # 事件流管理
│   ├── checkpointStore.ts            # 检查点存储
│   ├── turnLifecycle.ts              # 回合生命周期
│   ├── immediateReply.ts             # 即时回复生成
│   ├── slotFilling.ts                # V4.1 槽位填充
│   ├── questionLedger.ts             # V4.1 问题账本
│   ├── defaultAssumptions.ts         # V4.1 默认假设引擎
│   ├── nodes/                        # 10 个专职节点
│   │   ├── orchestratorNode.ts
│   │   ├── intakeNode.ts
│   │   ├── demandNode.ts
│   │   ├── productNode.ts
│   │   ├── mvpNode.ts
│   │   ├── techNode.ts
│   │   ├── riskNode.ts
│   │   ├── handoffNode.ts
│   │   ├── reviewerNode.ts
│   │   └── reflectionNode.ts
│   ├── tools/                        # 11 个 Agent Tool
│   │   ├── briefTools.ts
│   │   ├── evaluationTools.ts
│   │   ├── handoffTools.ts
│   │   ├── memoryTools.ts
│   │   ├── toolRegistry.ts
│   │   └── toolTypes.ts
│   ├── memory/                       # 四层记忆系统
│   │   ├── memoryTypes.ts
│   │   ├── workingMemory.ts
│   │   ├── episodicMemory.ts
│   │   ├── semanticMemory.ts
│   │   └── skillLibrary.ts
│   ├── prompts/
│   │   ├── promptBuilder.ts
│   │   ├── promptContracts.ts
│   │   └── jsonSchemaHints.ts
│   ├── adapters/                     # 适配器
│   │   ├── legacyAgentAdapter.ts
│   │   ├── mcpLikeToolAdapter.ts
│   │   └── productBriefAdapter.ts
│   ├── evals/                        # Agent 评估
│   │   ├── evalTypes.ts
│   │   ├── handoffEvaluator.ts
│   │   ├── regressionCases.ts
│   │   └── workflowEvaluator.ts
│   └── ui/                           # Agent UI 组件
│       ├── AgentDebugPanel.tsx
│       ├── AgentEventTimeline.tsx
│       ├── AgentGraphPanel.tsx
│       ├── AgentInterruptCard.tsx
│       ├── AgentMemoryPanel.tsx
│       ├── AgentProgressIndicator.tsx
│       ├── AgentSkillPanel.tsx
│       ├── AgentSlotPanel.tsx
│       ├── AgentTaskBoard.tsx
│       └── AgentThinkingBubble.tsx
│
└── assets/
    ├── hero.png
    └── vite.svg
```

---

## 2. 页面流程（路由追踪）

### 当前用户路径：

```
/ (LandingPage)
├── 配置 AI → /settings (SettingsPage)
├── 开始构思 → /new (NewIdeaPage)
│   ├── Agent 模式 → /agent/:id (AgentWorkspacePageV4) ← V4 Graph Runtime
│   └── 四步流程 → /discovery/:id (DemandDiscoveryPage)
│       ├── /product/:id (ProductFramingPage)
│       ├── /business/:id (BusinessFramingPage)
│       ├── /technical/:id (TechnicalPlanningPage)
│       ├── /scope/:id (MvpScopePage)
│       ├── /blind-spot/:id (BlindSpotReviewPage)
│       └── /handoff/:id (DeveloperHandoffPage) ← 核心输出
├── 历史 → /history (HistoryPage)
├── 旧版 redirect: /guide/:id → /product/:id
├── 旧版 redirect: /preview/:id → /handoff/:id
└── 旧版 redirect: /output/:id → /handoff/:id
```

### 路由表（不可动）：
| 路径 | 组件 | 状态 |
|------|------|------|
| `/` | LandingPage | ✅ 活跃 |
| `/new` | NewIdeaPage | ✅ 活跃 |
| `/discovery/:id` | DemandDiscoveryPage | ✅ 活跃 |
| `/product/:id` | ProductFramingPage | ✅ 活跃 |
| `/business/:id` | BusinessFramingPage | ✅ 活跃 |
| `/technical/:id` | TechnicalPlanningPage | ✅ 活跃 |
| `/scope/:id` | MvpScopePage | ✅ 活跃 |
| `/blind-spot/:id` | BlindSpotReviewPage | ✅ 活跃 |
| `/handoff/:id` | DeveloperHandoffPage | ✅ 活跃 |
| `/agent/:id` | AgentWorkspacePageV4 | ✅ 活跃 |
| `/history` | HistoryPage | ✅ 活跃 |
| `/settings` | SettingsPage | ✅ 活跃 |
| `/guide/:id` | → redirect | 🔴 重定向 |
| `/preview/:id` | → redirect | 🔴 重定向 |
| `/output/:id` | → redirect | 🔴 重定向 |

---

## 3. 数据结构审计

### 核心类型层次

```
ProductBrief (顶层)
├── id, createdAt, updatedAt
├── rawIdea: string
├── ideaInput: IdeaInputState {rawIdea, targetUser?, scenario?, problem?, projectType?}
├── mode: CopilotMode ('beginner' | 'builder' | 'review')
├── stages: CopilotStages
│   ├── discovery: DemandDiscoveryState (需求证据、痛点频率等)
│   ├── product: ProductFramingState (一句话定义、目标用户、AI 价值)
│   ├── business: BusinessFramingState (用户价值、ROI、变现)
│   ├── technical: TechnicalPlanningState (前后端、数据库、Mock策略)
│   ├── mvp: MvpScopeState (Must/Should/OutOfScope/V2)
│   └── blindSpot: BlindSpotReviewState (四种风险、反证)
├── finalHandoff?: FinalHandoff
│   ├── productBrief, mvpScope, devSpec
│   ├── technicalArchitecture, dataStructure
│   ├── acceptanceCriteria, developmentPrompt
│   ├── knowledgeReferences, evaluation
│   └── validationWarnings
├── developmentPrompt: string
└── steps: Record<string, StepData> (legacy 兼容)
```

### AiSuggestion 模式

所有 AI 输出字段都使用统一的 `AiSuggestion<T>` 包装：
```typescript
AiSuggestion<T> {
  value: T;
  reason: string;
  risks?: string[];
  alternatives?: string[];
  accepted: boolean;
  editedByUser: boolean;
  source?: 'ai' | 'error' | 'local-rule' | 'mock';
}
```

### 关键发现

1. **FinalHandoff 已经包含 devSpec、technicalArchitecture、acceptanceCriteria**，但没有独立的 DEV_SPEC 和 CODEX_TASK_PACK 类型
2. **没有需求质量评分字段** — 缺少 requirementQuality、ambiguityScore
3. **没有 EARS 格式验收标准** — acceptanceCriteria 是自由文本
4. **没有决策记录** — 用户在每个阶段的确认/否定没有结构化日志
5. **ProductBrief 没有 schemaVersion** — 仅 FinalHandoff 有

---

## 4. AI 调用链路

### 完整链路追踪：

```
用户输入
  ↓
页面组件 (e.g. MvpScopePage)
  ↓
api/evaluate.ts::suggestStage() / optimizeHandoff() / evaluateStep()
  ↓
prompts/::buildXxxPrompt() — 构建 system + user prompt
  ↓
api/evaluate.ts::callCopilotJson() — 核心AI调用函数
  ├── 检查 API 就绪 (V4.4: assertApiReady)
  ├── 检查缓存 (LRU, prompt-aware cache key)
  ├── 构建请求体 (OpenAI-compatible)
  ├── fetch('/api/ai-proxy', {method: 'POST'})
  │   ├── 本地开发: vite.config.ts::localAiProxy() 中间件
  │   └── 生产环境: vercel.json → api/ai-proxy.ts Edge Function
  │       └── 转发到 OpenAI-compatible endpoint
  ├── extractAIContent() — 从 response 提取文本
  ├── extractJson() — 8 策略 JSON 修复管线
  │   ├── 1. 直接 JSON.parse
  │   ├── 2. 剥离 ``` 围栏
  │   ├── 3. 花括号平衡匹配
  │   ├── ... (共 8 层)
  │   └── 8. 贪婪正则 + 修复（兜底）
  ├── validateAIOutputReferencesInput() — 加权引用校验
  └── 返回结构化结果
  ↓
页面组件更新 ProductBrief 状态
  ↓
useProductBrief::save() → localStorage.setItem('vibepilot_briefs', ...)
```

### Agent V4 AI 调用链路：

```
AgentWorkspacePageV4
  ↓
graphRuntime.ts::runGraphTurn()
  ├── parseUserIntent() — 解析用户意图
  ├── assertApiReady() — API 就绪检查
  ├── callCopilotJson() — AI 调用
  │   └── 构建全量上下文 (brief stages + slot filling + question ledger)
  ├── 执行节点 command (UPDATE_BRIEF, CREATE_TASK, etc.)
  └── 持久化 session → graphStore
```

### 关键性能参数：
- 默认超时: 50s (Vercel Hobby 限制)
- 重试次数: 3 次（指数退避）
- 缓存: LRU 50 条
- MVP 快速通道: 压缩上下文 + 轻量 prompt

---

## 5. localStorage 审计

### 全部 localStorage Key：

| Key | 数据类型 | 读写文件 | 用途 |
|-----|---------|---------|------|
| `vibepilot_briefs` | ProductBrief[] | useProductBrief, History, Landing, App | **核心数据** — 所有 ProductBrief |
| `vibepilot_current_id` | string | useProductBrief | 当前项目 ID |
| `vibepilot_ai_config` | AIConfig | evaluate.ts | AI API 配置 |
| `vibepilot_ai_connection_status` | string | evaluate.ts | 连接状态 |
| `vibepilot_ai_response_cache_v1` | Map | evaluate.ts | AI 响应缓存 |
| `vibepilot_api_health_v4` | ApiHealthState | apiHealth.ts | API 健康状态 |
| `vibepilot_handoff_snapshots_v1` | HandoffSnapshot[] | snapshotStore.ts | 交付快照 |
| `vibepilot_handoff_traces_v1` | HandoffTrace[] | traceStore.ts | 生成追溯 |
| `vibepilot_agent_workflows_v2` | AgentWorkflow[] | workflowStore.ts | V2 Agent 工作流 |
| `vibepilot_agent_sessions_v3` | AgentSession[] | sessionStore.ts | V3 Agent 会话 |
| `vibepilot_agent_graph_v4` | AgentGraphSession[] | graphStore.ts | **V4 Agent 会话（主力）** |
| `vibepilot_agent_memory_v1` | EpisodicMemory[] | episodicMemory.ts | 情景记忆 |
| `vibepilot_agent_skills_v1` | Skill[] | skillLibrary.ts | 技能库 |

### 关键发现：

1. **`vibepilot_briefs` 是最关键的 key** — 所有产品数据都在这里
2. **没有数据版本号** — ProductBrief 没有 schemaVersion，升级只能靠 normalizeBrief() 从旧结构推断
3. **旧 brief 没有 stages 字段** — migrateLegacySteps() 负责从旧 steps 迁移
4. **读取时自动 normalize** — loadAll() 中调用 normalizeBrief()，所以旧数据总能被兼容
5. **ErrorBoundary 硬删数据** — `localStorage.removeItem('vibepilot_briefs')`，可能丢失用户数据

---

## 6. README 叙事审计

### 当前 README 讲的故事：

1. **产品定位**: "Agentic Product Decision OS" — 面向面试的 React 全栈项目
2. **技术亮点**: V4.4 API Required Runtime Lock, V4.3 Real Agent Runtime, V4.2 Immediate Reply, V4.1 Anti-Loop, V4.0 Agent Graph
3. **四阶段流程**: Idea Diagnosis → MVP Decision → Tech Decision → Developer Handoff
4. **10 个面试 Talking Points**: 8 策略 JSON 修复、6 类 AI 错误、加权引用校验等
5. **目标用户**: 面试官看到的 portfolio 项目

### 问题：

1. **定位偏"面试项目"而非"产品工具"** — 需要转向面向 vibe coding 新手的决策辅助工具
2. **闭环不完整** — 当前只到 Development Prompt，缺少 DEV_SPEC 和 CODEX_TASK_PACK 两个关键交付物
3. **没有强调"决策记录"** — 用户在每个阶段的确认/否定没有结构化记录
4. **缺少进度可视化** — 10 步流程没有明确的进度条

---

## 7. 风险点

| 风险 | 严重度 | 位置 | 说明 |
|------|--------|------|------|
| **useProductBrief 是单点** | 🔴 高 | hooks/useProductBrief.ts | 所有数据读写都通过它，修改需极度小心 |
| **types.ts 是单文件** | 🟡 中 | types.ts | 333 行，扩展时容易变杂乱 |
| **evaluate.ts 是巨石** | 🟡 中 | api/evaluate.ts | 2100+ 行，包含配置、调用、JSON修复、缓存、评估 |
| **Agent 三代并存** | 🟡 中 | agent/, agent-v3/, agent-v4/ | 维护负担重，但当前只需保持 V4 不破坏 |
| **localStorage 无版本号** | 🟡 中 | useProductBrief.ts | ProductBrief 无 schemaVersion，迁移只能靠字段检测 |
| **ErrorBoundary 硬删数据** | 🟡 中 | App.tsx:31 | 崩溃时清空 vibepilot_briefs，极端情况下丢失所有项目 |
| **HistoryPage 直接读 localStorage** | 🟢 低 | HistoryPage.tsx | 绕过 useProductBrief，数据可能不一致 |
| **LandingPage 直接读 localStorage** | 🟢 低 | LandingPage.tsx:14 | 判断 hasHistory |

---

## 8. 不可动代码（本轮绝对不修改）

| 文件/目录 | 原因 |
|-----------|------|
| `src/agent-v4/` (全部) | V4 Agent Graph Runtime，复杂状态机，本轮不碰 |
| `src/agent-v3/` (全部) | V3 遗留架构，保持兼容但不改 |
| `src/agent/` (全部) | V2 遗留架构，保持兼容但不改 |
| `src/api/evaluate.ts` | 2100+ 行核心引擎，改动风险极大 |
| `src/api/apiHealth.ts` | V4.4 API 健康系统，稳定不动 |
| `src/hooks/useProductBrief.ts` | normalizeBrief() 和迁移逻辑不动，只在 ProductBrief 类型层面扩展 |
| `src/App.tsx` | 路由配置保持，新增路由只追加 |
| `src/pages/LandingPage.tsx` | 首页，UI 不动 |
| `src/pages/NewIdeaPage.tsx` | 入口页，不动 |
| `src/pages/SettingsPage.tsx` | 设置页，不动 |
| `src/pages/HistoryPage.tsx` | 历史页，不动 |
| `src/pages/AgentWorkspacePageV4.tsx` | Agent 工作区，不碰 |
| `src/pages/DemandDiscoveryPage.tsx` | 四步流程页面，不碰 |
| `src/pages/ProductFramingPage.tsx` | 四步流程页面，不碰 |
| `src/pages/BusinessFramingPage.tsx` | 四步流程页面，不碰 |
| `src/pages/TechnicalPlanningPage.tsx` | 四步流程页面，不碰 |
| `src/pages/MvpScopePage.tsx` | 四步流程页面，不碰 |
| `src/pages/BlindSpotReviewPage.tsx` | 四步流程页面，不碰 |
| `src/pages/DeveloperHandoffPage.tsx` | 交付页，不动核心逻辑 |
| `src/components/StageLayout.tsx` | 共享布局，不动 |
| `src/index.css` | 设计系统，不动 |
| `src/lib/utils.ts` | 工具函数，不动 |
| `src/data/steps.ts` | 10 步配置，不动 |
| `src/evaluation/` | 评估引擎，不碰 |
| `src/knowledge/` | 知识库，不碰 |
| `src/spec/` | 现有 spec builder，不动但可能被新模块引用 |
| `src/trace/` | 追溯系统，不碰 |
| `src/snapshot/` | 快照系统，不碰 |
| `src/prompts/` | Prompt 工程，不碰 |

---

## 9. 可最小改造代码（安全修改范围）

| 文件 | 改造方式 | 风险 |
|------|---------|------|
| **`src/types.ts`** | 新增类型（追加，不删除旧类型） | 🟢 低 |
| **`src/pages/DeveloperHandoffPage.tsx`** | 底部新增 DEV_SPEC + CODEX_TASK_PACK 展示区 | 🟢 低 |
| **`src/pages/OutputPage.tsx`** | 从重定向恢复为独立页面，展示新的输出格式 | 🟡 中 |
| **`src/components/`** | 新增组件（不修改现有组件） | 🟢 低 |
| **`src/lib/`** | 新增工具模块（不修改 utils.ts） | 🟢 低 |
| **`src/hooks/useProductBrief.ts`** | 仅扩展 normalizeBrief() 以兼容新字段 | 🟡 中 |
| **`src/App.tsx`** | 仅追加路由，不修改现有路由 | 🟢 低 |

---

## 10. 当前与目标闭环的差距

### 目标闭环：
```
Raw Idea
→ Problem Framing      ← 当前: DemandDiscoveryPage (部分覆盖)
→ User Scenario        ← 当前: ProductFramingPage (部分覆盖)
→ Demand Evidence      ← 当前: DemandDiscoveryPage 中有需求证据字段
→ MVP Scope            ← 当前: MvpScopePage ✅ 已覆盖
→ Risk Counterargument  ← 当前: BlindSpotReviewPage ✅ 已覆盖
→ Tech Constraints     ← 当前: TechnicalPlanningPage ✅ 已覆盖
→ Acceptance Criteria  ← 当前: 散布在 FinalHandoff 中
→ DEV_SPEC             ← 当前: spec/buildStructuredDevSpec 存在但非独立交付物
→ CODEX_TASK_PACK      ← 🔴 缺失！不存在类型定义和构建器
```

### 具体差距：

| 目标节点 | 当前状态 | 差距 |
|---------|---------|------|
| Raw Idea | ✅ NewIdeaPage | 无差距 |
| Problem Framing | 🟡 DemandDiscoveryPage | 缺失：结构化问题框架、歧义检测 |
| User Scenario | 🟡 ProductFramingPage | 缺失：场景完整性评分 |
| Demand Evidence | 🟡 DemandDiscoveryState | 缺失：需求质量评分框架 |
| MVP Scope | ✅ MvpScopePage | 缺失：范围控制门（scope creep detection 已有） |
| Risk Counterargument | ✅ BlindSpotReviewPage | 缺失：风险结构化的反证格式 |
| Tech Constraints | ✅ TechnicalPlanningPage | 缺失：约束条件的结构化输出 |
| Acceptance Criteria | 🟡 FinalHandoff | 缺失：EARS 格式验收标准 |
| DEV_SPEC | 🟡 spec/buildStructuredDevSpec | 存在但未独立交付 |
| CODEX_TASK_PACK | 🔴 缺失 | **完全不存在** |

### 核心差距总结：

1. **没有 DEV_SPEC 独立交付物** — 当前 devSpec 是 FinalHandoff 的一个文本字段
2. **没有 CODEX_TASK_PACK** — 类型定义、构建器、展示组件全缺失
3. **没有需求质量评分** — 无法量化需求完整度
4. **没有歧义检测** — 无法识别模糊表述
5. **没有决策记录** — 用户的确认/否定没有日志
6. **没有 EARS 验收标准** — 验收标准是自由文本，不够结构化
7. **没有进度可视化** — 10 阶段闭环没有百分比进度条
8. **OutputPage 已被废弃** — 重定向到 handoff，缺少独立输出页
