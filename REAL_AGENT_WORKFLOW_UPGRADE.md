# V5.2 Real Agent Workflow Runtime Upgrade

## 为什么过去容易像提示词工具

V4.x 的 Agent 架构本质上是一个 **AI 驱动的命令执行循环**：

```
用户输入 → LLM 返回 JSON 命令 → Runtime 执行命令 → 更新状态 → 展示回复
```

这个架构的问题：
1. **工具调用不可见**：用户看不到 Agent 调用了什么工具、传了什么参数、得到了什么结果
2. **没有 Observation 循环**：工具结果直接变成状态补丁，没有结构化的观察记录
3. **没有任务图**：Agent 的"计划"隐含在 LLM 的 JSON 输出中，没有可追踪的任务结构
4. **没有人工确认门**：关键决策（如 MVP 范围、DEV_SPEC）没有显式的用户确认环节
5. **记忆不回读**：写入的记忆和技能不会被后续轮次引用
6. **工具没有权限分级**：所有工具平权，没有安全边界

## 什么是真 Agent

真 Agent 的最低标准：

```
User Goal → Agent 理解目标 → 拆解任务 → 生成计划 → 调用工具 → 获得 Observation → 更新状态 → 判断下一步 → 等待人类确认 → 生成交付物 → 写入记忆/技能
```

核心区别：
- **任务图 (TaskGraph)**：Agent 有明确的任务列表和依赖关系
- **工具调用 (ToolCall)**：每次工具调用都有输入、输出、权限级别、副作用分类
- **观察循环 (Observation Loop)**：工具结果被转为结构化的 Observation，Agent 基于 Observation 决策
- **人工确认 (Human Approval)**：关键决策必须用户确认才能继续
- **记忆回读 (Memory Recall)**：Agent 每轮读取相关记忆和技能
- **权限分级 (Permission Levels)**：工具按 read/write_state/generate_artifact/external_ai/dangerous 分级

## 本轮新增核心模块

### 1. AgentTaskGraph

位置：`src/agent-v4/taskGraph/taskGraphTypes.ts`

9 个决策任务的有向图：
1. Problem Framing
2. User Scenario
3. Demand Evidence
4. MVP Scope（需确认）
5. Risk Counterargument（需确认）
6. Tech Constraints
7. Acceptance Criteria
8. DEV_SPEC（需确认）
9. CODEX_TASK_PACK（需确认）

每个任务包含：`AgentTask` → `AgentStep[]` → `AgentToolCallRecord[]` → `AgentObservation[]`

### 2. TaskGraph Runtime

位置：`src/agent-v4/taskGraph/taskGraphRuntime.ts`

主函数 `runAgentTaskGraphTurn()`：
1. `assertApiReady()`
2. 获取或创建 TaskGraph
3. 找到当前任务
4. 构建 Planner Prompt（含 Skill/Memory 上下文）
5. 调用 LLM Planner
6. 执行工具调用（最多 4 个/轮）
7. 生成 Observation
8. 处理 Approval 请求
9. 更新图状态
10. 返回结果

### 3. 工具注册表升级

位置：`src/agent-v4/tools/toolTypes.ts`、`src/agent-v4/taskGraph/tools/taskGraphTools.ts`

每个工具新增元数据：
- `permissionLevel`: read / write_state / generate_artifact / external_ai / dangerous
- `sideEffect`: none / state_update / artifact_generation / external_call
- `requiresApproval`: boolean

新增 12 个真实内部工具：
1. `inspectBriefContext` — 读取 Brief 上下文
2. `evaluateRequirementQualityTool` — 需求质量评估
3. `detectAmbiguityTool` — 歧义检测
4. `deriveScopeControlTool` — MVP 范围控制
5. `generateEarsCriteriaTool` — EARS 验收标准
6. `buildDevSpecTool` — 生成 DEV_SPEC
7. `buildCodexTaskPackTool` — 生成 CODEX_TASK_PACK
8. `validateCodexTaskPackTool` — 校验任务包
9. `createObservationTool` — 创建观察记录
10. `requestHumanApprovalTool` — 请求人工确认
11. `writeDecisionMemoryTool` — 写入决策记忆
12. `createSkillFromDecisionTool` — 沉淀技能

### 4. Human Approval

位置：`src/agent-v4/taskGraph/humanApproval.ts`

关键任务（MVP Scope、Risk、DEV_SPEC、CODEX_TASK_PACK）在继续前需要用户确认：
- 用户通过 → 任务继续
- 用户拒绝 → 任务回退，记录拒绝原因
- 未确认的产物标注"未完全确认，仅供草案参考"

### 5. Skill Library

位置：`src/agent-v4/taskGraph/skillLibrary.ts`

6 个预置技能：
1. MVP Scope Control
2. Risk Counterargument
3. EARS Acceptance Criteria
4. Codex Task Pack Builder
5. API Connection Diagnosis
6. Frontend Visual Cleanup

Planner Prompt 每轮接收 `relevantSkills` 摘要，Agent 不是从零想，而是调用技能。

### 6. Memory Runtime

位置：`src/agent-v4/taskGraph/memoryRuntime.ts`

TaskGraph 专用记忆系统：
- `decision` — 关键决策记录
- `bad_case` — 失败案例
- `reflection` — 反思总结
- `preference` — 用户偏好
- `skill_usage` — 技能使用记录

Runtime 每轮：
1. 读取 relevant skills
2. 读取 relevant memories
3. 写入关键 decision memory
4. 工具失败时写入 bad_case memory

### 7. UI Console Panels

位置：`src/agent-v4/ui/TaskGraphPanel.tsx`、`ToolCallsPanel.tsx`、`ObservationsPanel.tsx`、`ApprovalsPanel.tsx`

AgentWorkspacePageV4 新增 4 个面板：
1. **任务图面板** — 显示 TaskGraph 进度和任务列表
2. **工具调用面板** — 显示最近 20 个工具调用（工具名、权限、状态、时间）
3. **观察面板** — 显示最近 20 个 Observation（证据、风险、建议）
4. **确认面板** — 显示 pending approvals，支持通过/拒绝操作

### 8. DecisionOutputPage Execution Trace

新增 Agent 执行追踪 section：
- 任务完成统计
- 工具调用统计
- 观察记录统计
- 确认请求统计
- 引用的记忆和技能

## 架构吸收说明

| 来源 | 吸收内容 | 落地位置 |
|------|----------|----------|
| LangGraph | StateGraph, Checkpoint, Human-in-the-loop | AgentTaskGraph, checkpointStore, humanApproval |
| AutoGen | Event-driven, Tool Extension | eventLog, toolRegistry |
| CrewAI | Agent, Task, Flow, Memory | AgentRole, AgentTask, skillLibrary, memoryRuntime |
| Claude Code | Skills, Hooks, Tool Use | skillLibrary, toolRegistry |
| Aider | File Plan, Lint/Build loop | CodexTaskPack |
| MCP | Tool Schema, Permission | toolTypes, permissionLevel |

## 当前仍没做什么

1. **没有 shell 执行**：不实现 runShellTool
2. **没有真实 MCP Server**：工具是内部函数调用
3. **没有数据库**：所有数据存储在 localStorage
4. **没有向量检索**：记忆和技能匹配基于关键词
5. **没有多端协作**：单用户本地运行
6. **没有 Repo Map Tool**：本轮先实现前端内部 Repo Context 结构
7. **没有 GitHub Tool**：不实现外部 GitHub 写操作
8. **没有 Background Agent**：所有执行同步进行

## 下一步

1. **Repo Map Tool** — 分析项目文件结构，生成 Repo Context
2. **GitHub Tool** — 只读访问 GitHub 仓库
3. **Sandboxed Tool Execution** — 安全的工具执行环境
4. **Background Agent** — 后台异步执行长时间任务
5. **MCP Server** — 将工具暴露为 MCP 协议
