# AUDIT_TOOL_REGISTRY.md

> **审计日期**: 2026-06-02
> **审计范围**: `src/agent-v4/tools/toolRegistry.ts`, `briefTools.ts`, `handoffTools.ts`, `memoryTools.ts`
> **审计标准**: 工具是否够"手和脚"？是否执行真实外部动作？

---

## 1. 工具清单

| # | toolName | description | inputSchema | output | side effect | permission | 真实外部动作 |
|---|----------|-------------|-------------|--------|-------------|------------|-------------|
| 1 | `updateBriefStage` | 更新 ProductBrief 某阶段 | `{targetStage, patch, source}` | `{briefPatch}` | 修改 Brief 对象 | 无 | ❌ 内部状态 |
| 2 | `createFinding` | 创建分析判断 | `{title, summary, evidence[], risks[], confidence}` | `{statePatch}` | 追加 findings 数组 | 无 | ❌ 内部状态 |
| 3 | `createTask` | 创建任务 | `{title, description, required}` | `{statePatch}` | 追加 tasks 数组 | 无 | ❌ 内部状态 |
| 4 | `completeTask` | 标记任务完成 | `{taskId, status}` | `{statePatch}` | 修改 task status | 无 | ❌ 内部状态 |
| 5 | `moveNode` | 移动到不同节点 | `{targetNodeId}` | `{statePatch}` | 修改 currentNodeId | 无 | ❌ 内部状态 |
| 6 | `legacyGenerateLocalHandoff` | [Legacy] 本地生成 Handoff | `{}` | `{briefPatch}` | 修改 finalHandoff | 无 | ❌ 内部状态 |
| 7 | `optimizeHandoffWithAI` | AI 优化 Handoff | `{}` | `{briefPatch}` | 调用 LLM + 修改 finalHandoff | 无 | ⚠️ 调 LLM API |
| 8 | `evaluateHandoffQuality` | 评估 Handoff 质量 | `{}` | `{briefPatch, statePatch}` | 修改 evaluation + lastEvaluation | 无 | ❌ 内部状态 |
| 9 | `applyLocalHandoffFixes` | 应用本地修复 | `{}` | `{briefPatch}` | 修改 finalHandoff | 无 | ❌ 内部状态 |
| 10 | `createMemory` | 创建记忆条目 | `{type, title, content, tags, source}` | `{data}` | 写入 localStorage | 无 | ❌ 内部状态 |
| 11 | `createSkill` | 创建可复用技能 | `{title, triggerTags, applicableWhen, recommendedSteps}` | `{data}` | 写入 localStorage | 无 | ❌ 内部状态 |
| 12 | `askUser` | 暂停并询问用户 | `{question}` | `{statePatch}` | 修改 status + pendingQuestions | 无 | ❌ 内部状态 |

---

## 2. 统计

- **总工具数**: 12
- **内部状态修改**: 11 (92%)
- **调用外部 API**: 1 (8%) — `optimizeHandoffWithAI`
- **读写文件系统**: 0 (0%)
- **网络请求**: 0 (0%) — 除 LLM API
- **数据库操作**: 0 (0%)
- **有 permission level**: 0 (0%)
- **需要用户审批**: 0 (0%)

---

## 3. 判断：当前工具是否够"手和脚"？

**不够。** 当前工具是"内脏器官"——只能修改自身状态，不能与外部世界交互。

### 缺失的工具类别

#### 3.1 文件系统工具（P0）

| 工具名 | 用途 | 优先级 |
|--------|------|--------|
| `readFile` | 读取用户项目文件 | P0 |
| `writeFile` | 写入产物文件 | P0 |
| `listDirectory` | 列出目录结构 | P1 |
| `searchFiles` | 搜索文件内容 | P1 |

#### 3.2 网络工具（P1）

| 工具名 | 用途 | 优先级 |
|--------|------|--------|
| `httpRequest` | 调用外部 API | P1 |
| `searchWeb` | 搜索网络信息 | P2 |
| `fetchUrl` | 获取网页内容 | P2 |

#### 3.3 项目感知工具（P0）

| 工具名 | 用途 | 优先级 |
|--------|------|--------|
| `readProjectStructure` | 读取项目目录树 | P0 |
| `readPackageJson` | 读取依赖信息 | P0 |
| `runBuild` | 执行构建命令 | P1 |
| `runTest` | 执行测试命令 | P1 |

#### 3.4 产物工具（P1）

| 工具名 | 用途 | 优先级 |
|--------|------|--------|
| `exportMarkdown` | 导出 Markdown 文件 | P1 |
| `exportJSON` | 导出 JSON 文件 | P1 |
| `createPR` | 创建 GitHub PR | P2 |

#### 3.5 记忆回读工具（P0）

| 工具名 | 用途 | 优先级 |
|--------|------|--------|
| `queryMemory` | 查询历史记忆 | P0 |
| `querySkills` | 查询可用技能 | P0 |
| `matchSkill` | 匹配适用技能 | P0 |

---

## 4. 工具架构问题

### 4.1 无权限分级

当前所有工具同级执行，无安全边界。应增加：

```typescript
interface AgentTool {
  name: string;
  permissionLevel: 'safe' | 'confirm' | 'dangerous';
  // safe: 自动执行
  // confirm: 需要用户确认
  // dangerous: 需要二次确认 + 审计日志
}
```

### 4.2 无工具使用统计

不知道哪些工具被高频使用、哪些从未使用。应增加调用计数。

### 4.3 无工具错误重试

`executeToolCall` 捕获错误但不重试。对于网络类工具需要重试机制。

### 4.4 工具结果不持久化

tool result 只在当 turn 内存在于 events 中，不作为独立对象持久化。

---

## 5. 改造建议

### P0（必须改）

1. 新增 `queryMemory` 工具，让 Agent 能读取历史记忆
2. 新增 `querySkills` 工具，让 Agent 能匹配可复用技能
3. 为所有工具增加 `permissionLevel` 字段
4. `optimizeHandoffWithAI` 标记为 `confirm` 级别

### P1（应该改）

5. 新增 `readFile` / `writeFile` 工具（标记为 `confirm`）
6. 新增 `httpRequest` 工具（标记为 `dangerous`）
7. 工具调用结果持久化为独立 `ToolResult` 对象
8. 工具使用统计计数器

### P2（暂不改）

9. 新增 `searchWeb` / `fetchUrl`
10. 新增 `createPR`
11. 工具错误自动重试

---

## 6. 结论

当前 12 个工具中，11 个是纯内部状态修改，1 个调用 LLM API。没有文件系统、网络、数据库、项目感知工具。

**类比**: 当前 Agent 有 12 根手指，但全部长在脑壳里面——能摸到自己的脑子，摸不到外面的世界。
