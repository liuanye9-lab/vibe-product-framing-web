# AUDIT_AGENT_GAPS.md

> **审计日期**: 2026-06-02
> **审计目的**: 汇总所有缺口，给出 P0/P1/P2 分级和最小真 Agent 闭环定义

---

## 1. 缺口总表

| # | 维度 | 缺口 | 严重度 | 说明 |
|---|------|------|--------|------|
| G1 | Memory | 记忆不回读 | P0 | 写入 localStorage 但 runtime 不读取 |
| G2 | Skills | 技能不被引用 | P0 | 创建后沉睡，不注入 prompt |
| G3 | Hands | 无外部工具 | P0 | 12 个工具全是内部状态修改 |
| G4 | Brain | 无显式 Plan | P0 | 只有 node graph routing |
| G5 | Brain | Critic 是启发式 | P1 | 评分基于字符串长度 |
| G6 | Feedback | 无 Bad Case | P1 | 失败不学习 |
| G7 | Rules | 工具无权限 | P1 | 所有工具同级 |
| G8 | Nerves | Checkpoint 不可操作 | P1 | 代码存在但 UI 不暴露 |
| G9 | Memory | Working Memory 空壳 | P1 | 未使用 |
| G10 | Eyes | 无项目感知 | P2 | 不能读取文件系统 |
| G11 | Brain | 无多 Agent | P2 | 单 Agent 运行 |
| G12 | Hands | 无 streaming | P2 | 一次性返回 |

---

## 2. P0 必须改什么

### 2.1 Memory 回读（G1）

**现状**: `episodicMemory.ts` 有 `getMemoryItems()` 但 runtime 不调用。

**改法**:
1. 在 `graphRuntime.ts` 的 `attemptAIAgentCall()` 中查询记忆
2. 在 systemPrompt 中注入 `## 历史经验` 段落
3. 限制注入量：最近 3 条 reflection + 2 个相关 skill

**工作量**: ~50 行代码

### 2.2 Skill 引用（G2）

**现状**: `skillLibrary.ts` 有 `getSkills(tag)` 但 runtime 不调用。

**改法**:
1. 在 orchestrator 或 intake 节点查询匹配 skill
2. 注入 AI prompt 作为参考模板
3. 新增 `applySkill` 工具让 Agent 主动应用

**工作量**: ~80 行代码

### 2.3 外部工具（G3）

**现状**: 12 个工具全是内部状态修改。

**改法**:
1. 新增 `readProjectFile` 工具（读取当前项目文件）
2. 新增 `exportArtifact` 工具（导出产物到文件）
3. 新增 `queryMemory` 工具（查询历史记忆）
4. 新增 `querySkills` 工具（查询可用技能）

**工作量**: ~200 行代码

### 2.4 显式 Plan（G4）

**现状**: 计划隐含在 node routing 中。

**改法**:
1. 新增 `AgentPlan` 类型
2. 在 orchestrator 节点生成 Plan
3. Plan 注入 AI prompt

**工作量**: ~150 行代码

---

## 3. P1 应该改什么

### 3.1 Critic 语义化（G5）

**现状**: `evaluateHandoffQuality` 基于字符串长度评分。

**改法**: 用 LLM 评分替代本地启发式。

**工作量**: ~100 行代码

### 3.2 Bad Case 系统（G6）

**改法**:
1. 新增 `BadCase` 类型
2. AI 失败时自动创建
3. Bad Case 注入 prompt

**工作量**: ~120 行代码

### 3.3 工具权限（G7）

**改法**: 每个工具增加 `permissionLevel`，`confirm`/`dangerous` 级别需用户确认。

**工作量**: ~80 行代码

### 3.4 Checkpoint UI（G8）

**改法**: 在 AgentWorkspacePageV4 的 Debug 面板增加"回滚到此点"按钮。

**工作量**: ~60 行代码

---

## 4. P2 暂时不做什么

- G10: 文件系统访问（需要安全沙箱）
- G11: 多 Agent 协作（架构改动大）
- G12: Streaming 输出（前端改动大）

---

## 5. 最小真 Agent 闭环

```
User Goal
  ↓
Plan (显式 AgentPlan 对象)
  ↓
Tool Call (含 permission level)
  ↓
Observation (tool result + 外部反馈)
  ↓
State Update (session + memory 回读)
  ↓
Human Confirmation (危险操作需审批)
  ↓
Artifact (可交付产物)
  ↓
Memory / Skill Update (从结果学习)
  ↓
下一轮: Memory + Skill 注入 prompt ← 闭环
```

### 当前闭环 vs 目标闭环

| 步骤 | 当前 | 目标 |
|------|------|------|
| User Goal | ✅ | ✅ |
| Plan | ❌ 隐式 | ✅ 显式 |
| Tool Call | ⚠️ 只有内部工具 | ✅ 含外部工具 |
| Observation | ❌ 缺失 | ✅ |
| State Update | ✅ | ✅ |
| Human Confirmation | ⚠️ 只有 ASK_USER | ✅ 分级确认 |
| Artifact | ✅ Handoff | ✅ |
| Memory Update | ⚠️ 只写不读 | ✅ 读写闭环 |
| Skill Update | ⚠️ 只存不用 | ✅ 匹配+执行 |

---

## 6. 改造优先级排序

```
P0-1: Memory 回读         → 50 行  → 让 Agent 有记忆
P0-2: Skill 引用          → 80 行  → 让 Agent 会复用
P0-3: queryMemory/querySkills 工具 → 100 行 → 让记忆可查询
P0-4: AgentPlan 类型       → 150 行 → 让 Agent 会规划

P1-1: Bad Case 系统       → 120 行 → 让 Agent 从失败学习
P1-2: 工具权限分级         → 80 行  → 安全边界
P1-3: LLM Critic          → 100 行 → 评分语义化
P1-4: Checkpoint UI       → 60 行  → 用户可回滚

总计 P0: ~380 行
总计 P1: ~360 行
```

---

## 7. 结论

当前项目距离"真 Agent"的核心差距是 **记忆闭环断裂** 和 **工具能力不足**。

P0 改造约 380 行代码即可实现"记忆驱动行为"的最小闭环。这是最高效的改造路径。
