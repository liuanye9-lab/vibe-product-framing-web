# OPEN_SOURCE_AGENT_BENCHMARK.md

> **审计日期**: 2026-06-02
> **审计目的**: 对标 8 个主流开源 Agent 框架，提炼可吸收机制
> **对标项目**: LangGraph, AutoGen, CrewAI, Claude Code, OpenHands, Aider, MCP, OpenClaw

---

## 1. LangGraph

### 1.1 核心机制

- **Stateful Graph**: 有向图 + 状态机，节点是函数，边是条件路由
- **Durable Execution**: checkpoint 每步持久化，支持 time-travel
- **Human-in-the-loop**: `interrupt_before` / `interrupt_after` 节点级中断
- **Streaming**: 节点级 streaming 输出
- **Subgraph**: 支持嵌套子图

### 1.2 本项目可吸收什么

| 机制 | 吸收方式 | 优先级 |
|------|----------|--------|
| Checkpoint 恢复 UI | 当前 checkpointStore 已有，缺 UI 暴露 | P1 |
| 条件边 | 当前 canTransition 是静态的，可改为函数 | P2 |
| interrupt_before/after | 当前只有 ASK_USER，可扩展为节点级中断 | P1 |
| Subgraph | 当前无，可将 handoff 生成作为子图 | P2 |

### 1.3 本轮不该吸收什么

- **Streaming**: 前端改动大，P2
- **自定义 State reducer**: 当前 state 结构够用
- **LangChain 生态**: 重量级依赖，不适合轻量前端

### 1.4 安全风险

- LangGraph 本身无安全机制，需自建
- Checkpoint 恢复可能覆盖用户编辑

### 1.5 融合建议

- **P0**: 暴露 checkpoint 恢复 UI（代码已存在）
- **P1**: 引入 `interrupt_before` 概念，让 handoff 等关键节点强制确认
- **P2**: 条件边函数化

---

## 2. AutoGen

### 2.1 核心机制

- **Multi-Agent Conversation**: 多 Agent 对话协作
- **Agent Roles**: AssistantAgent, UserProxyAgent, GroupChatManager
- **Code Execution**: 支持 Docker 沙箱执行代码
- **Human Proxy**: 人类作为 Agent 参与对话
- **Tool Use**: 函数注册为工具

### 2.2 本项目可吸收什么

| 机制 | 吸收方式 | 优先级 |
|------|----------|--------|
| Agent Role 定义 | 当前只有 nodeId，可增加 role 描述 | P2 |
| Human Proxy | 当前 ASK_USER 是单向的，可改为双向对话 | P1 |
| Tool 注册模式 | 当前已有类似模式（toolRegistry） | ✅ 已有 |

### 2.3 本轮不该吸收什么

- **Multi-Agent**: 单 Agent 足够，P2
- **Docker 沙箱**: 前端项目不需要
- **GroupChat**: 复杂度高，不适用

### 2.4 安全风险

- Code execution 需要沙箱隔离
- 多 Agent 对话可能导致状态不一致

### 2.5 融合建议

- **P1**: 将 ASK_USER 改为双向对话，用户可以追问 Agent
- **P2**: 引入 Agent Role 概念，每个节点有明确角色描述

---

## 3. CrewAI

### 3.1 核心机制

- **Agents**: 有角色、目标、背景的 Agent
- **Tasks**: 有描述、预期输出、负责 Agent 的任务
- **Flows**: 任务编排（sequential, hierarchical）
- **Guardrails**: 输出验证和重试
- **Memory**: 短期、长期、实体记忆
- **Knowledge**: RAG 知识库

### 3.2 本项目可吸收什么

| 机制 | 吸收方式 | 优先级 |
|------|----------|--------|
| Task 结构化 | 当前 AgentGraphTask 太弱，可增强 | P0 |
| Guardrails | 当前 JSON 修复是 ad-hoc，可系统化 | P1 |
| Memory 分层 | 当前只有一种 memory，可分短期/长期 | P1 |
| Agent 角色定义 | 每个 node 可有 role/goal/backstory | P2 |

### 3.3 本轮不该吸收什么

- **Hierarchical Flow**: 当前 sequential 足够
- **Knowledge RAG**: 需要向量库，当前约束不允许
- **Crew 编排**: 多 Agent 协作，P2

### 3.4 安全风险

- Guardrails 可能被绕过
- Memory 可能泄露跨项目信息

### 3.5 融合建议

- **P0**: 增强 Task 对象，增加 acceptanceCriteria, dependencies
- **P1**: 系统化 Guardrails（JSON 验证、输出校验、重试策略）
- **P1**: Memory 分层（session memory vs long-term memory）

---

## 4. Claude Code

### 4.1 核心机制

- **CLI Agent**: 终端内运行的编码 Agent
- **Tool Use**: Read, Write, Edit, Bash, Grep, Glob
- **Context Window**: 自动管理上下文窗口
- **Permission System**: 分级权限（safe, confirm, dangerous）
- **Memory**: CLAUDE.md 项目记忆文件
- **Plan Mode**: 先规划后执行

### 4.2 本项目可吸收什么

| 机制 | 吸收方式 | 优先级 |
|------|----------|--------|
| Permission System | 当前无权限分级，必须引入 | P0 |
| CLAUDE.md 记忆 | 当前 memory 不回读，可引入文件记忆 | P0 |
| Plan Mode | 当前无显式 Plan，可引入 | P0 |
| Tool Use 模式 | Read/Write/Edit/Bash 工具集 | P1 |
| Context 管理 | 自动截断和摘要 | P2 |

### 4.3 本轮不该吸收什么

- **CLI 界面**: 当前是 Web App
- **Bash 执行**: 安全风险高，需要沙箱
- **大上下文窗口**: 需要更多 token，成本高

### 4.4 安全风险

- 文件读写需要路径白名单
- Bash 执行需要沙箱
- Memory 文件可能被篡改

### 4.5 融合建议

- **P0**: 引入 Permission System（工具权限分级）
- **P0**: 引入项目记忆文件（类似 CLAUDE.md）
- **P0**: 引入 Plan Mode（先规划后执行）
- **P1**: 新增 Read/Write/Edit 工具

---

## 5. OpenHands

### 5.1 核心机制

- **Sandboxed Execution**: Docker 沙箱内执行代码
- **Event Stream**: 所有操作作为事件流
- **Agent Controller**: 管理 Agent 生命周期
- **Observation**: 每个动作产生观察结果
- **Browser Agent**: 可操作浏览器

### 5.2 本项目可吸收什么

| 机制 | 吸收方式 | 优先级 |
|------|----------|--------|
| Event Stream | 当前已有类似机制（eventLog） | ✅ 已有 |
| Observation 模式 | 当前缺 Observation 对象 | P0 |
| Agent Controller | 当前 runtime 是隐式的，可显式化 | P1 |

### 5.3 本轮不该吸收什么

- **Docker 沙箱**: 前端项目不需要
- **Browser Agent**: 当前不需要
- **复杂 Controller**: 当前 runtime 够用

### 5.4 安全风险

- 沙箱逃逸风险
- 浏览器操作可能泄露信息

### 5.5 融合建议

- **P0**: 引入 Observation 对象（tool result 结构化）
- **P1**: 显式化 Agent Controller（runtime 拆分）

---

## 6. Aider

### 6.1 核心机制

- **Git-native**: 所有修改自动 commit
- **Architect Mode**: 先规划再执行
- **Edit Format**: 多种编辑格式（diff, whole, udiff）
- **Context管理**: 自动发现相关文件
- **Lint/Test Integration**: 修改后自动验证

### 6.2 本项目可吸收什么

| 机制 | 吸收方式 | 优先级 |
|------|----------|--------|
| Architect Mode | 当前无 Plan，可引入 | P0 |
| 修改后验证 | 当前无自动验证，可引入 | P1 |
| Context 自动发现 | 当前 context 是手动构建 | P2 |

### 6.3 本轮不该吸收什么

- **Git-native**: 当前不需要版本控制集成
- **多种 Edit Format**: 当前只有 JSON patch
- **自动文件发现**: 需要文件系统访问

### 6.4 安全风险

- 自动 commit 可能提交敏感信息
- 自动文件发现可能遍历敏感目录

### 6.5 融合建议

- **P0**: 引入 Architect Mode（Plan → Execute 分离）
- **P1**: 修改后自动验证（lint/test）

---

## 7. MCP (Model Context Protocol)

### 7.1 核心机制

- **Tool Protocol**: 标准化的工具描述协议
- **Resource Protocol**: 标准化的资源访问协议
- **Server/Client**: 服务器暴露工具，客户端调用
- **Schema Definition**: JSON Schema 描述工具输入输出
- **Permission Model**: 工具权限声明

### 7.2 本项目可吸收什么

| 机制 | 吸收方式 | 优先级 |
|------|----------|--------|
| Tool Schema | 当前已有 inputSchema，可标准化 | P1 |
| Permission Model | 当前无，必须引入 | P0 |
| Resource Protocol | 当前无资源访问，可引入 | P1 |

### 7.3 本轮不该吸收什么

- **Server/Client 架构**: 当前是单体前端
- **Network Protocol**: 当前不需要远程工具
- **复杂权限协商**: 简化为三级权限

### 7.4 安全风险

- 工具描述可能被注入恶意指令
- 权限提升风险

### 7.5 融合建议

- **P0**: 引入工具权限模型（safe/confirm/dangerous）
- **P1**: 标准化 Tool Schema（与 MCP 兼容）
- **P1**: 引入 Resource Protocol（文件/API 资源访问）

---

## 8. OpenClaw

### 8.1 核心机制

- **Claw Machine**: 抓取式任务执行
- **Skill System**: 可复用技能库
- **Memory Bank**: 项目记忆库
- **Verification Loop**: 执行 → 验证 → 修复循环

### 8.2 本项目可吸收什么

| 机制 | 吸收方式 | 优先级 |
|------|----------|--------|
| Skill System | 当前已有 skillLibrary，需增强回读 | P0 |
| Memory Bank | 当前 memory 不回读，需增强 | P0 |
| Verification Loop | 当前无自动验证，可引入 | P1 |

### 8.3 本轮不该吸收什么

- **Claw Machine 概念**: 不适用当前场景
- **复杂 Skill 编排**: 简化为模板匹配

### 8.4 安全风险

- Skill 可能包含过时或错误的指导
- Memory Bank 可能泄露跨项目信息

### 8.5 融合建议

- **P0**: 增强 Skill System（回读+匹配+执行）
- **P0**: 增强 Memory Bank（回读+注入 prompt）
- **P1**: 引入 Verification Loop

---

## 9. 综合融合路线图

### P0: 最小真 Agent 闭环

| 来源 | 机制 | 改造项 |
|------|------|--------|
| Claude Code | Permission System | 工具权限分级 |
| Claude Code | CLAUDE.md | 项目记忆文件 |
| Claude Code | Plan Mode | 显式 Plan 对象 |
| LangGraph | Checkpoint UI | 暴露回滚功能 |
| CrewAI | Task 增强 | acceptanceCriteria, dependencies |
| OpenHands | Observation | tool result 结构化 |
| OpenClaw | Skill 回读 | memory/skill 注入 prompt |

### P1: 质量提升

| 来源 | 机制 | 改造项 |
|------|------|--------|
| CrewAI | Guardrails | 系统化输出验证 |
| CrewAI | Memory 分层 | 短期/长期记忆 |
| AutoGen | Human Proxy | 双向对话 |
| Aider | 修改后验证 | 自动 lint/test |
| OpenClaw | Verification Loop | 执行→验证→修复 |
| MCP | Tool Schema | 标准化工具描述 |

### P2: 扩展能力

| 来源 | 机制 | 改造项 |
|------|------|--------|
| LangGraph | 条件边 | 动态路由 |
| LangGraph | Subgraph | 子图编排 |
| AutoGen | Multi-Agent | 多 Agent 协作 |
| Aider | Context 发现 | 自动文件发现 |
| MCP | Resource Protocol | 资源访问协议 |

---

## 10. 安全风险汇总

| 风险 | 来源 | 缓解措施 |
|------|------|----------|
| 文件读写泄露 | Claude Code, Aider | 路径白名单 |
| 代码执行逃逸 | AutoGen, OpenHands | 沙箱隔离 |
| 工具权限提升 | MCP | 三级权限 + 审批 |
| Memory 跨项目泄露 | OpenClaw, CrewAI | 项目隔离 |
| Skill 注入攻击 | OpenClaw | Skill 审计 |
| Checkpoint 覆盖 | LangGraph | 确认机制 |

---

## 11. 结论

8 个框架的核心共识：

1. **Memory 必须回读** — 所有成熟 Agent 都有记忆驱动行为
2. **工具必须有权限** — 安全边界是 Agent 的基本要求
3. **Plan 必须显式** — 先规划后执行是 Agent 的核心模式
4. **Observation 必须结构化** — tool result 必须可追踪
5. **验证必须闭环** — 执行→验证→修复是质量保证

本项目最高效的改造路径是吸收 Claude Code 的 Permission + Plan + Memory 模式，结合 CrewAI 的 Task 增强和 OpenClaw 的 Skill 回读。
