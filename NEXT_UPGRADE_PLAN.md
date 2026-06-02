# NEXT_UPGRADE_PLAN.md

> **日期**: 2026-06-02
> **基于**: AUDIT_AGENT_RUNTIME, AUDIT_TOOL_REGISTRY, AUDIT_TASK_GRAPH, AUDIT_MEMORY_SKILL, AUDIT_AGENT_GAPS, OPEN_SOURCE_AGENT_BENCHMARK
> **目标**: 将 Vibe Decision Copilot 从"提示词引导工具"升级为"真实 Agent"

---

## 1. 升级目标

**最小真 Agent 闭环**:

```
User Goal → Plan → Tool Call → Observation → State Update → Human Confirmation → Artifact → Memory/Skill Update
                                                                                              ↓
                                                              下一轮: Memory + Skill 注入 prompt ← 闭环
```

---

## 2. P0 改造项（必须做）

### 2.1 Memory 回读注入

**目标**: Agent 每轮开始时读取历史记忆，注入 AI prompt。

**改造文件**:
- `src/agent-v4/graphRuntime.ts` — `attemptAIAgentCall()` 中查询记忆
- `src/agent-v4/memory/episodicMemory.ts` — 无改动
- `src/agent-v4/memory/skillLibrary.ts` — 无改动

**改造内容**:
1. 在 `attemptAIAgentCall()` 开头调用 `getMemoryItems('reflection', 3)` 和 `getSkills()`
2. 在 `systemPrompt` 末尾追加 `## 历史经验` 段落
3. 限制注入量：最多 3 条 memory + 2 个 skill

**验收标准**:
- [ ] Agent 回复中引用历史记忆
- [ ] 相似项目自动匹配已有 skill
- [ ] 注入量不超过 500 tokens

**工作量**: ~50 行代码

### 2.2 queryMemory / querySkills 工具

**目标**: 让 Agent 能主动查询记忆和技能。

**改造文件**:
- `src/agent-v4/tools/toolRegistry.ts` — 注册新工具
- `src/agent-v4/tools/memoryTools.ts` — 新增查询函数

**改造内容**:
1. 新增 `queryMemory` 工具：`{type?, keyword?, limit?}` → `AgentMemoryItem[]`
2. 新增 `querySkills` 工具：`{tag?, limit?}` → `AgentSkill[]`
3. 在 toolRegistry 中注册

**验收标准**:
- [ ] Agent 可以通过 command 查询记忆
- [ ] 查询结果注入当轮上下文

**工作量**: ~100 行代码

### 2.3 AgentPlan 对象

**目标**: 引入显式 Plan 对象，替代隐式 node routing。

**改造文件**:
- `src/agent-v4/types.ts` — 新增 `AgentPlan`, `AgentPlanStep` 类型
- `src/agent-v4/graphStore.ts` — Plan 持久化
- `src/agent-v4/graphRuntime.ts` — orchestrator 生成 Plan
- `src/agent-v4/nodes/orchestratorNode.ts` — 生成 Plan 的逻辑

**新增类型**:
```typescript
interface AgentPlan {
  id: string;
  goal: string;
  steps: AgentPlanStep[];
  currentStepIndex: number;
  status: 'planning' | 'executing' | 'completed' | 'failed';
  acceptanceCriteria: string[];
  createdAt: string;
  updatedAt: string;
}

interface AgentPlanStep {
  id: string;
  description: string;
  targetNodeId: AgentNodeId;
  toolCalls: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  observation?: string;
}
```

**改造内容**:
1. 在 `AgentGraphState` 中新增 `currentPlan?: AgentPlan`
2. orchestrator 节点根据用户目标生成 Plan
3. Plan 步骤与 node transition 对齐
4. Plan 注入 AI prompt

**验收标准**:
- [ ] Agent 首轮生成 Plan
- [ ] Plan 步骤可追踪
- [ ] Plan 注入 AI prompt

**工作量**: ~150 行代码

### 2.4 工具权限分级

**目标**: 每个工具有 permissionLevel，危险操作需确认。

**改造文件**:
- `src/agent-v4/tools/toolTypes.ts` — 新增 permissionLevel
- `src/agent-v4/tools/toolRegistry.ts` — 注册时声明权限
- `src/agent-v4/graphRuntime.ts` — 执行前检查权限

**新增字段**:
```typescript
interface AgentTool {
  // ... existing
  permissionLevel: 'safe' | 'confirm' | 'dangerous';
}
```

**权限分配**:
| 工具 | 权限 |
|------|------|
| updateBriefStage | safe |
| createFinding | safe |
| createTask | safe |
| completeTask | safe |
| moveNode | safe |
| createMemory | safe |
| createSkill | safe |
| askUser | safe |
| queryMemory | safe |
| querySkills | safe |
| optimizeHandoffWithAI | confirm |
| evaluateHandoffQuality | safe |
| applyLocalHandoffFixes | confirm |

**改造内容**:
1. `AgentTool` 接口新增 `permissionLevel`
2. `executeCommands()` 检查权限，`confirm`/`dangerous` 需用户确认
3. UI 层显示待确认工具列表

**验收标准**:
- [ ] 所有工具有权限声明
- [ ] confirm 级别工具暂停等待用户确认
- [ ] 审计日志记录权限检查

**工作量**: ~80 行代码

---

## 3. P1 改造项（应该做）

### 3.1 Bad Case 收集

**目标**: AI 失败时自动创建 Bad Case 记录。

**改造文件**:
- `src/agent-v4/types.ts` — 新增 `AgentBadCase` 类型
- `src/agent-v4/graphRuntime.ts` — AI 失败时创建 bad case
- `src/agent-v4/tools/memoryTools.ts` — 新增 `createBadCase` 工具

**新增类型**:
```typescript
interface AgentBadCase {
  id: string;
  sessionId: string;
  nodeId: AgentNodeId;
  errorType: string;
  errorMessage: string;
  userInput: string;
  aiPrompt: string;
  rawOutput?: string;
  createdAt: string;
}
```

**工作量**: ~120 行代码

### 3.2 LLM Critic

**目标**: 用 LLM 评分替代本地启发式。

**改造文件**:
- `src/agent-v4/tools/handoffTools.ts` — `evaluateHandoffQuality` 改用 LLM

**工作量**: ~100 行代码

### 3.3 Checkpoint 回滚 UI

**目标**: 用户可以在 Debug 面板回滚到历史 checkpoint。

**改造文件**:
- `src/pages/AgentWorkspacePageV4.tsx` — Debug 面板增加回滚按钮

**工作量**: ~60 行代码

### 3.4 双向对话

**目标**: ASK_USER 改为双向对话，用户可以追问 Agent。

**改造文件**:
- `src/pages/AgentWorkspacePageV4.tsx` — 对话区支持追问
- `src/agent-v4/graphRuntime.ts` — 支持追问模式

**工作量**: ~100 行代码

---

## 4. P2 改造项（暂不做）

| 项 | 说明 | 工作量 |
|----|------|--------|
| 文件系统工具 | read/write/list | ~200 行 |
| 条件边函数化 | 动态路由 | ~100 行 |
| 多 Agent 协作 | 子图编排 | ~500 行 |
| Streaming 输出 | 前端 streaming | ~300 行 |
| Context 自动发现 | 文件扫描 | ~150 行 |

---

## 5. 实施顺序

```
Phase 1: Memory 闭环 (P0-1 + P0-2)
  ↓ 验证: Agent 能引用历史记忆
Phase 2: Plan 对象 (P0-3)
  ↓ 验证: Agent 首轮生成 Plan
Phase 3: 工具权限 (P0-4)
  ↓ 验证: 危险工具需确认
Phase 4: Bad Case + LLM Critic (P1-1 + P1-2)
  ↓ 验证: 失败自动收集，评分语义化
Phase 5: Checkpoint UI + 双向对话 (P1-3 + P1-4)
  ↓ 验证: 用户可回滚，可追问
```

---

## 6. 验证方式

每个 Phase 完成后运行：

```bash
npm run lint
npm run build
```

手动验证清单：

- [ ] Phase 1: 创建项目 → 第二轮 Agent 回复中引用第一轮的记忆
- [ ] Phase 2: 输入想法 → Agent 生成结构化 Plan
- [ ] Phase 3: 触发 handoff → 系统暂停等待用户确认
- [ ] Phase 4: AI 调用失败 → 自动创建 Bad Case
- [ ] Phase 5: 点击 checkpoint → 状态恢复到该点

---

## 7. 回滚策略

每个 Phase 独立，可单独回滚：

- Phase 1 回滚: 删除 `getMemoryItems` 调用，恢复原 systemPrompt
- Phase 2 回滚: 删除 `AgentPlan` 类型和相关逻辑
- Phase 3 回滚: 删除 `permissionLevel` 字段和权限检查
- Phase 4 回滚: 删除 `AgentBadCase` 类型和收集逻辑
- Phase 5 回滚: 删除 UI 按钮和追问逻辑

---

## 8. 验收标准

### 最小真 Agent 闭环验收

- [ ] Agent 首轮生成 Plan
- [ ] Agent 每轮读取历史记忆
- [ ] Agent 可查询记忆和技能
- [ ] 工具有权限分级
- [ ] 危险操作需用户确认
- [ ] AI 失败自动收集 Bad Case
- [ ] 用户可回滚到历史 checkpoint
- [ ] `npm run lint` 通过
- [ ] `npm run build` 通过

---

## 9. 工作量估算

| Phase | 改造项 | 代码行数 | 预计时间 |
|-------|--------|----------|----------|
| Phase 1 | Memory 闭环 | ~150 行 | 2 小时 |
| Phase 2 | Plan 对象 | ~150 行 | 2 小时 |
| Phase 3 | 工具权限 | ~80 行 | 1 小时 |
| Phase 4 | Bad Case + Critic | ~220 行 | 3 小时 |
| Phase 5 | UI 增强 | ~160 行 | 2 小时 |
| **总计** | | **~760 行** | **~10 小时** |

---

## 10. 结论

将 Vibe Decision Copilot 从"提示词引导工具"升级为"真实 Agent"需要约 760 行代码改造，预计 10 小时。

核心改造是**记忆闭环**（Phase 1）——让 Agent 从"失忆"变为"有记忆"。这是投入产出比最高的改造。
