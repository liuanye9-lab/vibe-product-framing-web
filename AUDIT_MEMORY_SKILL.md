# AUDIT_MEMORY_SKILL.md

> **审计日期**: 2026-06-02
> **审计范围**: `src/agent-v4/memory/`, `src/agent-v4/tools/memoryTools.ts`, `src/lib/decisionLog.ts`
> **审计标准**: 是"记忆展示"还是"记忆驱动行为"？

---

## 1. 记忆系统清单

### 1.1 Event Log（事件日志）

| 属性 | 值 |
|------|-----|
| 存储位置 | `session.events`（localStorage via graphStore） |
| 容量 | 最多 200 条 |
| 写入时机 | 每个 runtime 操作（user_message, agent_message, tool_called, ai_call_started/completed/failed, checkpoint, error 等） |
| 读取时机 | UI 渲染时读取 |
| 是否注入 AI prompt | ❌ 否 |
| 是否影响决策 | ❌ 否 |

**结论**: Event Log 是纯展示用，不影响 Agent 行为。

### 1.2 Checkpoint（检查点）

| 属性 | 值 |
|------|-----|
| 存储位置 | `session.checkpoints`（localStorage via graphStore） |
| 容量 | 最多 20 个 |
| 写入时机 | 每个 node transition 前 |
| 读取时机 | `restoreCheckpoint()` 函数存在 |
| UI 暴露 | ⚠️ Debug 面板显示列表，但无回滚按钮 |
| 是否影响决策 | ❌ 否 |

**结论**: Checkpoint 有回滚能力但未暴露给用户。

### 1.3 Episodic Memory（情景记忆）

| 属性 | 值 |
|------|-----|
| 存储位置 | `localStorage` key: `vibepilot_agent_memory_v4` |
| 容量 | 最多 100 条 |
| 写入时机 | `CREATE_MEMORY` command 执行时 |
| 读取 API | `getMemoryItems(type?, limit)` 存在 |
| 是否被 runtime 调用 | ❌ 否 |
| 是否注入 AI prompt | ❌ 否 |

**结论**: 写入存在但不回读。Agent 创建记忆后，下一轮不读取。

### 1.4 Skill Library（技能库）

| 属性 | 值 |
|------|-----|
| 存储位置 | `localStorage` key: `vibepilot_agent_skills_v4` |
| 容量 | 最多 50 个 |
| 写入时机 | `CREATE_SKILL` command 执行时 |
| 读取 API | `getSkills(tag?)`, `getAllSkills()` 存在 |
| 是否被 runtime 调用 | ❌ 否 |
| 是否注入 AI prompt | ❌ 否 |
| 是否有 skill executor | ❌ 否 |

**结论**: Skills 只存不用。创建后沉睡在 localStorage。

### 1.5 Decision Log（决策日志）

| 属性 | 值 |
|------|-----|
| 存储位置 | `localStorage` key: `vibepilot_decision_logs` |
| 容量 | 最多 100 条 |
| 写入内容 | `{id, briefId, phase, summary, createdAt}` |
| 读取 API | `listDecisionLogEntries(briefId)` 存在 |
| 是否被 runtime 调用 | ❌ 否 |
| 信息密度 | 极低——只有 phase 名和 summary 字符串 |

**结论**: Decision Log 信息密度太低，不反哺 Agent。

### 1.6 Working Memory（工作记忆）

| 属性 | 值 |
|------|-----|
| 存储位置 | `session.state.workingMemory` |
| 类型 | `Record<string, unknown>` |
| 写入时机 | 未见显式写入 |
| 读取时机 | UI StateView 面板显示 |
| 是否影响决策 | ❌ 否 |

**结论**: Working Memory 是空壳，未被使用。

---

## 2. 记忆流向分析

```
用户输入 → Runtime → LLM → Commands → Tools → 写入 Memory/Skill
                                                     ↓
                                              localStorage 沉睡
                                                     ↓
                                              下一轮不读取 ← 断裂点
```

**记忆流向在"写入"之后断裂。** 这是"记忆展示"，不是"记忆驱动行为"。

---

## 3. 对标：真 Agent 的记忆系统

| 特征 | 当前 | 真 Agent |
|------|------|----------|
| 短期记忆 | session.state ✅ | session.state ✅ |
| 长期记忆 | 写入不回读 ❌ | 每轮检索注入 prompt ✅ |
| 工作记忆 | 空壳 ❌ | 动态维护上下文 ✅ |
| 情景记忆 | 只写不读 ❌ | 相似场景匹配 ✅ |
| 技能记忆 | 只存不执行 ❌ | 匹配+执行 ✅ |
| 反思记忆 | 写入但不改行为 ❌ | 修改策略/prompt ✅ |

---

## 4. 具体问题

### 4.1 Memory 不回读

**问题**: `graphRuntime.ts` 的 `attemptAIAgentCall()` 构建 prompt 时，不查询 memory 或 skill。

**影响**: Agent 每轮都是"失忆"的——不记得上个项目的教训、不记得用户的偏好、不记得之前的失败。

**修复**: 在 `attemptAIAgentCall()` 中加入：

```typescript
const recentMemories = getMemoryItems(undefined, 5);
const relevantSkills = getSkills(session.state.currentNodeId);
// 注入 systemPrompt
```

### 4.2 Skills 不被引用

**问题**: `skillLibrary.ts` 的 `getSkills()` 从未被 runtime 调用。

**影响**: 即使创建了"Web App MVP 收敛模板"这样的 skill，下一个 Web App 项目也不会自动应用。

**修复**: 在 orchestrator 或 intake 节点中查询匹配的 skill，注入 AI prompt。

### 4.3 Bad Case 不存在

**问题**: AI 调用失败时，只记录 `ai_call_failed` event，不创建 bad case 对象。

**影响**: 不能从失败模式学习。同一个 JSON parse 错误可能反复出现。

**修复**: 新增 `BadCase` 类型，AI 失败时自动创建。

### 4.4 decisionLog 信息密度低

**问题**: `addDecisionLogEntry(briefId, phase, summary)` 只存 3 个字段。

**影响**: 无法从决策历史中提取模式。

**修复**: 扩展为包含 AI 输入/输出、tool calls、用户反馈的结构化记录。

---

## 5. 改造建议

### P0: Memory 回读

1. 在 `attemptAIAgentCall()` 中查询 `getMemoryItems()` + `getSkills()`
2. 注入 systemPrompt 的 `## 历史经验` 部分
3. 限制注入量（最近 3 条 memory + 2 个 skill）

### P1: Bad Case 系统

4. 新增 `BadCase` 类型
5. AI 失败时自动创建 bad case
6. Bad Case 注入 prompt 作为负面示例

### P2: Skill 执行器

7. 新增 `executeSkill(skillId, context)` 工具
8. Skill 执行结果作为 Observation 记录

---

## 6. 结论

**当前是"记忆展示"，不是"记忆驱动行为"。**

记忆系统有完整的写入链路（Memory Tool → localStorage），但读取链路断裂（localStorage → Agent Context）。Agent 每轮都在"失忆"状态下运行。

**类比**: 当前是一个每天写日记但从来不翻日记的人。
