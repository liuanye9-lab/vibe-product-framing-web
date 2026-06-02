# AUDIT_TASK_GRAPH.md

> **审计日期**: 2026-06-02
> **审计范围**: `src/agent-v4/graph.ts`, `src/agent-v4/types.ts`, `src/agent-v4/nodes/`
> **审计标准**: 是否存在 Task / Plan / Step / Observation / Acceptance Criteria？

---

## 1. 当前图结构

### 1.1 节点定义

```
orchestrator → intake → demand → product → mvp → tech → risk → handoff → reviewer → reflection → end
```

共 12 个节点（含 `human_interrupt` 和 `end`）。

### 1.2 边定义

每个节点有预定义的可达节点列表。`orchestrator` 可达所有节点。

### 1.3 节点运行器

| 节点 | 运行器 | 是否调 LLM | 产出 |
|------|--------|-----------|------|
| orchestrator | `runOrchestratorNode` | ❌ 本地规则 | 路由 decision + commands |
| intake | `runIntakeNode` | ❌ 本地规则 | slot 检查 + ASK_USER |
| demand | `runDemandNode` | ❌ 本地规则 | commands |
| product | `runProductNode` | ❌ 本地规则 | commands |
| mvp | `runMvpNode` | ❌ 本地规则 | commands |
| tech | `runTechNode` | ❌ 本地规则 | commands |
| risk | `runRiskNode` | ❌ 本地规则 | commands |
| handoff | `runHandoffNode` | ❌ 本地规则 | commands |
| reviewer | `runReviewerNode` | ❌ 本地规则 | evaluation |
| reflection | `runReflectionNode` | ❌ 本地规则 | memory + skill commands |

**关键发现**: 所有节点运行器都是本地规则，不调 LLM。LLM 调用在 runtime 层（`attemptAIAgentCall()`），节点只做路由和命令组装。

---

## 2. 缺失的对象

### 2.1 Task 对象

**存在但弱**:

```typescript
interface AgentGraphTask {
  id: string;
  title: string;
  description: string;
  ownerNode: AgentNodeId;
  status: 'todo' | 'doing' | 'blocked' | 'done' | 'skipped';
  phase: AgentNodeId;
  required: boolean;
  createdAt: string;
  updatedAt: string;
}
```

**缺失**:
- ❌ 无 `acceptanceCriteria` 字段
- ❌ 无 `dependencies` 字段
- ❌ 无 `estimatedEffort` 字段
- ❌ 无 `actualResult` 字段
- ❌ 无 `toolCalls` 关联

### 2.2 Plan 对象

**完全缺失**。没有显式的 Plan 类型。当前的"计划"隐含在 node graph routing 中。

应有:

```typescript
interface AgentPlan {
  id: string;
  goal: string;
  steps: AgentPlanStep[];
  currentStepIndex: number;
  status: 'planning' | 'executing' | 'completed' | 'failed';
  acceptanceCriteria: string[];
  createdAt: string;
}

interface AgentPlanStep {
  id: string;
  description: string;
  toolCalls: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  observation?: string;
}
```

### 2.3 Step 对象

**完全缺失**。当前的"步骤"是 node transition，不是可追踪的执行步骤。

### 2.4 Observation 对象

**完全缺失**。tool result 在 events 中有记录，但不是独立的 Observation 对象。

应有:

```typescript
interface AgentObservation {
  id: string;
  stepId: string;
  toolCallId: string;
  result: unknown;
  success: boolean;
  duration: number;
  createdAt: string;
}
```

### 2.5 Acceptance Criteria

**存在于 FinalHandoff 中**，但不是 per-task 的。

```typescript
// 当前: handoff.acceptanceCriteria 是全局字符串
// 应有: 每个 Task 有自己的 acceptanceCriteria
```

---

## 3. 当前是 Node Graph 还是 AgentTaskGraph？

**是 Node Graph，不是 AgentTaskGraph。**

| 特征 | Node Graph (当前) | AgentTaskGraph (目标) |
|------|-------------------|----------------------|
| 节点类型 | 固定业务阶段 | 动态任务 |
| 边 | 预定义路由 | 任务依赖 |
| 执行 | 节点运行器 | Task + Tool + Observation |
| 状态 | currentNodeId | task[].status |
| 规划 | 隐式（routing） | 显式（Plan 对象） |
| 反馈 | event log | Observation → State Update |
| 回滚 | checkpoint（粗粒度） | per-step rollback |

---

## 4. 改造建议

### P0: 引入 Plan 和 Step 对象

```typescript
// 在 types.ts 中新增
interface AgentPlan { ... }
interface AgentPlanStep { ... }
interface AgentObservation { ... }

// 在 AgentGraphState 中新增
interface AgentGraphState {
  // ... existing
  currentPlan?: AgentPlan;
  observations: AgentObservation[];
}
```

### P1: 增强 Task 对象

```typescript
interface AgentGraphTask {
  // ... existing
  acceptanceCriteria: string[];
  dependencies: string[];  // task IDs
  toolCalls: string[];     // associated tool call IDs
  observations: string[];  // associated observation IDs
}
```

### P2: 动态节点

允许 Agent 在运行时创建新节点，而不是固定 10 个业务节点。

---

## 5. 结论

当前是一个**静态 Node Graph**——10 个固定业务节点，预定义边，节点运行器是本地规则。

距离 **AgentTaskGraph** 差距：
- 缺 Plan 对象
- 缺 Step 对象
- 缺 Observation 对象
- Task 对象太弱（无 acceptance criteria、无 dependencies）
- 无动态任务创建能力

**类比**: 当前是一条固定铁路（node graph），目标是一张可动态规划的公路网（task graph）。
