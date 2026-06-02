# AUDIT_AGENT_RUNTIME.md

> **审计日期**: 2026-06-02
> **审计范围**: `src/agent-v4/graphRuntime.ts`, `src/agent-v4/graph.ts`, `src/agent-v4/types.ts`
> **审计标准**: 真实 Agent 工作流（Brain + Hands + Eyes + Memory + Skills + Nerves + Rules + Feedback）

---

## 1. 当前真实能力

### 1.1 Brain（LLM + Planner + Critic）

| 能力 | 状态 | 证据 |
|------|------|------|
| LLM 调用 | ✅ 真实 | `callCopilotJson()` 每轮调用，通过 `/api/ai-proxy` 转发 |
| Planner | ✅ 存在 | `orchestratorNode` 做意图解析和节点路由 |
| Critic | ⚠️ 弱 | `reviewerNode` 和 `evaluateHandoffQuality` 存在，但评分逻辑基于字符串长度而非语义 |
| 意图解析 | ✅ 本地 | `parseIntent()` 基于关键词匹配，不调 LLM |
| 命令生成 | ✅ 真实 | AI 返回 JSON commands，runtime 解析执行 |

**结论**: Brain 有真实 LLM 调用，Planner 是本地规则路由，Critic 是长度启发式。

### 1.2 Hands（工具调用）

| 能力 | 状态 | 证据 |
|------|------|------|
| 工具注册 | ✅ 12 个工具 | `toolRegistry.ts` 注册 |
| 工具执行 | ✅ 真实 | `executeCommands()` 遍历 commands，调用 `executeToolCall()` |
| 结果影响 | ✅ 是 | `briefPatch` 和 `statePatch` 回写 session |
| 外部动作 | ❌ 无 | 所有工具都是内部状态修改，无文件/网络/数据库操作 |

**结论**: Hands 存在但是"内手"——只修改内存状态，不执行外部动作。

### 1.3 Eyes（上下文读取）

| 能力 | 状态 | 证据 |
|------|------|------|
| 读当前状态 | ✅ | `session.state` 完整传入每个 node |
| 读用户输入 | ✅ | `userMessage` 传入 |
| 读 Brief | ✅ | `ProductBrief` 完整传入 |
| 读运行结果 | ⚠️ 部分 | tool result 在同一 turn 内可用，但不跨 turn |
| 读项目文件 | ❌ | 无文件系统访问 |
| 读外部数据 | ❌ | 无网络请求（除 LLM API） |

**结论**: Eyes 只能看到 session 内的状态，无法读取外部项目上下文。

### 1.4 Memory（记忆系统）

| 能力 | 状态 | 证据 |
|------|------|------|
| Event Log | ✅ 持久化 | `eventLog.ts` → `session.events`，最多 200 条 |
| Checkpoint | ✅ 持久化 | `checkpointStore.ts` → `session.checkpoints`，最多 20 个 |
| Episodic Memory | ⚠️ 写入存在 | `memoryTools.ts` → `episodicMemory.ts`，localStorage |
| Memory 读取 | ❌ 不回读 | `getMemoryItems()` 存在但 runtime 不调用 |
| Skill Memory | ⚠️ 写入存在 | `skillLibrary.ts`，localStorage |
| Skill 读取 | ❌ 不回读 | `getSkills()` 存在但 runtime 不调用 |
| decisionLog | ⚠️ 简单 | 只存 phase + summary，不反哺 |

**结论**: Memory 是"写入展示"，不是"记忆驱动行为"。Agent 下一轮不读取历史记忆。

### 1.5 Skills（可复用工作流）

| 能力 | 状态 | 证据 |
|------|------|------|
| Skill 创建 | ✅ | `CREATE_SKILL` command → `createSkillTool()` |
| Skill 存储 | ✅ | localStorage，最多 50 个 |
| Skill 引用 | ❌ | runtime 不查询 skill library |
| Skill 执行 | ❌ | 无 skill executor |

**结论**: Skills 只是存储，不被引用或执行。

### 1.6 Nerves（事件流/Dashboard）

| 能力 | 状态 | 证据 |
|------|------|------|
| Event Stream | ✅ | 18 种事件类型，append-only |
| UI 可视化 | ✅ | `AgentEventTimeline`, `AgentGraphPanel` |
| 实时状态 | ✅ | `lastAIStatus`, `status`, `currentNodeId` |
| Dashboard | ⚠️ 部分 | 有状态面板，无可操作的控制台 |

**结论**: Nerves 存在且可用，但缺少可操作的控制台（如手动回滚、强制跳转）。

### 1.7 Rules（权限/确认/API Gate）

| 能力 | 状态 | 证据 |
|------|------|------|
| API Gate | ✅ 严格 | `assertApiReady()` 在 runtime 入口调用 |
| 禁止 fallback | ✅ | `ENABLE_MOCK_FALLBACK = false`，AI 失败 → status='failed' |
| Human Confirm | ✅ | `ASK_USER` command → `waiting_user` status |
| 工具权限 | ❌ | 无 permission level |
| 危险操作审批 | ❌ | 无 approval 机制 |

**结论**: API Gate 和禁止 fallback 做得好，但工具无权限分级。

### 1.8 Feedback（失败→Bad Case→Skill Patch）

| 能力 | 状态 | 证据 |
|------|------|------|
| 失败检测 | ✅ | `ai_call_failed` event，`status: 'failed'` |
| Bad Case | ❌ | 无 bad case 收集 |
| Skill Patch | ❌ | 无从失败生成 skill 的机制 |
| 反思节点 | ⚠️ 弱 | `reflectionNode` 检测低分，但只写 memory，不修改行为 |

**结论**: Feedback 链路断裂——能检测失败，但不能从失败学习。

---

## 2. 缺口分析

### P0 缺口（阻塞"真 Agent"定义）

| # | 缺口 | 影响 |
|---|------|------|
| 1 | Memory 不回读 | Agent 每轮是无状态的，不记得上一轮的教训 |
| 2 | Skills 不被引用 | 可复用工作流只存不用 |
| 3 | 工具无外部动作 | Hands 只是"内手"，不能读写文件、调 API、操作外部系统 |
| 4 | 无 Plan 对象 | 只有 node graph routing，没有显式的 Task Plan |

### P1 缺口（影响质量）

| # | 缺口 | 影响 |
|---|------|------|
| 5 | Critic 是长度启发式 | 评分不基于语义质量 |
| 6 | 无 Bad Case 收集 | 不能从失败模式学习 |
| 7 | Checkpoint 回滚未暴露 UI | 代码存在但用户不可用 |
| 8 | 工具无 permission level | 所有工具同级，无安全分级 |

### P2 缺口（可延后）

| # | 缺口 | 影响 |
|---|------|------|
| 9 | 无文件系统访问 | 不能读取用户项目代码 |
| 10 | 无多 Agent 协作 | 单 Agent 运行 |
| 11 | 无 streaming 输出 | 一次性返回 |

---

## 3. 风险评估

| 风险 | 严重度 | 说明 |
|------|--------|------|
| API Key 存 localStorage | 高 | 浏览器可访问，XSS 风险 |
| 无工具审批 | 中 | 所有工具自动执行 |
| Memory 无限增长 | 低 | 有 cap (100 items) 但无清理策略 |
| Session 数据丢失 | 中 | localStorage 清缓存即丢失 |

---

## 4. 改造建议

### 最小真 Agent 闭环（P0）

```
User Goal
  → Plan (显式 TaskPlan 对象)
  → Tool Call (含 permission level)
  → Observation (tool result + external feedback)
  → State Update (session + memory 回读)
  → Human Confirmation (危险操作需审批)
  → Artifact (可交付产物)
  → Memory / Skill Update (从结果学习)
```

### 具体改造项

1. **Memory 回读**: runtime 每轮开始时调用 `getMemoryItems()` + `getSkills()`，注入 AI prompt
2. **Skill 执行器**: 新增 `executeSkill(skillId, context)` 工具
3. **外部工具**: 新增 `readFile`, `writeFile`, `httpRequest`, `searchWeb` 等工具
4. **Plan 对象**: 新增 `AgentPlan { goal, steps[], currentStep, acceptanceCriteria }` 类型
5. **Bad Case 收集**: AI 失败时自动创建 bad case 记录
6. **工具权限**: 每个工具增加 `permissionLevel: 'safe' | 'confirm' | 'dangerous'`

---

## 5. 结论

**当前项目是不是"真 Agent"？**

**不是。** 当前是一个"LLM 驱动的阶段式决策流程"，具有以下 Agent 特征：
- ✅ 真实 LLM 调用
- ✅ 命令生成与执行
- ✅ 事件流与 checkpoint
- ✅ Human-in-the-loop

但缺少以下核心 Agent 特征：
- ❌ Memory 驱动行为（写入但不回读）
- ❌ Skill 引用与执行
- ❌ 外部工具调用
- ❌ 从失败学习
- ❌ 显式 Plan 对象

**类比**: 当前是"有大脑和神经系统的机器人，但手是假的，记忆是展示柜"。
