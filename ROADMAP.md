# ROADMAP — Vibe Decision Copilot

> 围绕 Spec-driven Development · Requirements Quality Evaluation · Codex Task Pack · Decision Versioning · Risk Counterargument · Human Confirmation Node

---

## 📍 P0：当前版本（2026-05-28）

### 核心闭环
```
Raw Idea → Problem Framing → User Scenario → Demand Evidence
→ MVP Scope → Risk Counterargument → Tech Constraints
→ Acceptance Criteria → DEV_SPEC → CODEX_TASK_PACK
```

### 已实现功能
| # | 功能 | 状态 |
|---|------|------|
| 1 | 10 阶段决策闭环数据结构 | ✅ |
| 2 | 需求质量评分框架（8 维度） | ✅ |
| 3 | 需求歧义检测（5 类模糊模式） | ✅ |
| 4 | MVP 范围控制（P0/P1/P2 + Out of Scope） | ✅ |
| 5 | EARS 验收标准生成（5 种模板） | ✅ |
| 6 | DEV_SPEC 构建器 | ✅ |
| 7 | CODEX_TASK_PACK 构建器 | ✅ |
| 8 | 10 阶段进度条可视化 | ✅ |
| 9 | DecisionOutputPage（独立输出页） | ✅ |
| 10 | 用户确认节点（ConfirmButton） | ✅ |
| 11 | 轻量决策记录（localStorage） | ✅ |
| 12 | 旧数据兼容（normalizeBrief 迁移） | ✅ |

### 已产出的文档
| 文档 | 路径 |
|------|------|
| 对标研究报告 | `RESEARCH_REPORT.md` |
| 架构审计报告 | `ARCHITECTURE_AUDIT.md` |
| 升级方案 | `UPGRADE_PLAN.md` |
| 变更日志 | `CHANGELOG.md` |
| 路线图 | `ROADMAP.md`（本文件） |
| 新版 README | `UPDATED_README.md` |
| 面试材料 | `INTERVIEW_STORY.md` |

---

## 📍 P1：下一步（短期）

### 需求澄清引擎（Clarify Engine）
- [ ] 借鉴 SpecFix：行为聚类检测需求歧义
- [ ] 借鉴 spec-kit：`/clarify` 主动澄清步骤
- [ ] 歧义检测升级为 AI 驱动（LLM-as-a-Judge）

### 需求质量评估闭环（Evaluator-Optimizer）
- [ ] 生成 → 评估 → 修复 → 再评估循环
- [ ] 借鉴 Anthropic Building Effective Agents 模式
- [ ] 需求质量评估结果反馈到各阶段

### 轻量版本记录
- [ ] Spec 版本 diff（轻量，不做复杂 git-like diff）
- [ ] 决策记录关联到版本
- [ ] 追溯每次变更的来源和依据

### Constitution 治理文件
- [ ] 项目级不变约束定义
- [ ] 所有 AI 产出遵循 Constitution
- [ ] 参考 spec-kit 和 Codex CLI

### 面试展示路径优化
- [ ] DEMO 流程脚本
- [ ] 核心话术精炼
- [ ] 关键页面截图/录屏

---

## 📍 P2：长期方向

### LLM-as-a-Judge 升级
- [ ] 需求质量评分从本地规则升级为 AI 驱动
- [ ] 参考 DeepEval、Agenta
- [ ] 多维度一致性检查

### AGENTS.md 分级加载
- [ ] 用户级 → 项目级 → 工作流级
- [ ] 借鉴 Codex CLI 的 AGENTS.md 机制

### 多 Agent 角色引入
- [ ] 审视者 Agent（Reviewer）：检查需求质量
- [ ] 反证者 Agent（Devil's Advocate）：挑战假设
- [ ] 参考 MetaGPT 多角色 SOP

### CODEX_TASK_PACK 增强
- [ ] 一键导出为 Codex CLI 可执行格式
- [ ] Sandbox 级别标注
- [ ] 人类审查节点标注
- [ ] 与 github/spec-kit 格式对齐

### 需求质量仪表盘
- [ ] 质量趋势图（长期质量变化）
- [ ] 项目维度质量对比
- [ ] 模板化报告

### 知识库扩展
- [ ] 更多内置案例/模板
- [ ] 行业垂直知识包
- [ ] 用户自定义模板

---

## 🚫 不做事项（明确排除）

| 事项 | 原因 | 替代方案 |
|------|------|---------|
| 全自动代码生成 | MetaGPT/OpenHands 已深耕此方向 | 聚焦前置决策，输出 Task Pack 交给 coding agent |
| 通用 Multi-Agent 框架 | AutoGen/CrewAI/LangGraph 已是成熟框架 | 专注产品决策领域深度 |
| 跳过人类确认的全自动 | 74 篇 RE+LLM 研究共识：最优模式是 AI 辅助+人类确认 | 所有关键节点保留确认步骤 |
| 实时协作/多人 | V1 聚焦 "单人+AI" | V2+ 考虑 |
| 向量数据库 | 当前知识库规模下价值有限 | 保持规则匹配 + LLM 上下文窗口 |
| 数据库 | 增加运维复杂度 | localStorage 已满足需求 |
| 登录系统 | 非核心价值 | 不做 |
| MCP Server | 过度工程 | 保持简单 |
| 大规模 UI 重写 | 本轮 P0 定位 | P2 可选 |
| 删除旧页面 | 破坏现有功能 | 只追加，不删除 |

---

## 📖 面试展示路径

### 核心叙事（30 秒电梯演讲）
> 我的项目不是普通 PRD 生成器。它是一个面向 Vibe Coding 的前期决策 Agent。
> 它解决的问题是：很多人让 AI 写代码前，没有把需求、用户、范围、验收标准想清楚。
> 我的系统把模糊想法转化为可交给 Codex 执行的任务包。

### 展示路径（5 分钟）
1. **问题陈述**（30s）：Vibe Coding 的痛点 — 没有想清楚就开始写代码
2. **解决方案**（60s）：10 阶段闭环流程 + Codex Task Pack
3. **技术亮点**（90s）：
   - 需求质量评分框架（8 维度本地规则）
   - EARS 验收标准生成
   - 歧义检测 + 范围控制
   - 基于 spec-kit/MetaGPT/LangGraph 对标的设计
4. **演示**（90s）：
   - 输入一个模糊想法
   - 展示 DecisionOutputPage 的 10 阶段结果
   - 展示 DEV_SPEC 和 CODEX_TASK_PACK
5. **未来规划**（30s）：P1 和 P2 方向的差异化价值
