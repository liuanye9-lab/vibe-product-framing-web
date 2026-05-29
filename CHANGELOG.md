# CHANGELOG — Vibe Decision Copilot

## V4.5 — Runtime Consistency & Source-of-Truth Patch (2026-05-29)
- 修复 Agent 运行时事件持久化（events → session.events）
- 修复 action intent 回复不回写 agent_message
- 确保 AI call events 在 UI 可见
- 移除 Agent 运行链路中的 generateLocalHandoff
- 修复 DecisionOutputPage useMemo 副作用
- 统一版本标签为 V4.5
- 新增 DecisionSpecBundle builder

## Vibe Decision Copilot P0 Upgrade (2026-05-28)

### Added
- **10 阶段决策闭环**：Raw Idea → Problem Framing → User Scenario → Demand Evidence → MVP Scope → Risk Counterargument → Tech Constraints → Acceptance Criteria → DEV_SPEC → CODEX_TASK_PACK
- **`src/types.ts`**：新增 CopilotPhase、DecisionStageProgress、RequirementQualityScore、AmbiguityIssue、ScopeControlResult、EarsRequirement、DevSpec、CodexTaskPack、DecisionLogEntry 等 P0 类型
- **`src/lib/progressCalculator.ts`**：10 阶段进度计算引擎，支持阶段状态推导和质量评分
- **`src/lib/requirementQuality.ts`**：8 维度需求质量评分框架（clarity/specificity/userEvidence/scopeControl/testability/technicalFeasibility/riskAwareness/codexExecutability）
- **`src/lib/ambiguityDetector.ts`**：需求歧义检测，覆盖模糊量词、空洞形容词、泛词、无边界范围
- **`src/lib/scopeControl.ts`**：MVP 范围控制，P0/P1/P2 分类 + 范围膨胀检测
- **`src/lib/ears.ts`**：EARS 验收标准生成（ubiquitous/event_driven/state_driven/optional/unwanted）
- **`src/lib/devSpecBuilder.ts`**：DEV_SPEC 构建器，整合 structured spec + EARS + scope control
- **`src/lib/codexTaskPackBuilder.ts`**：CODEX_TASK_PACK 构建器，导出可执行任务包
- **`src/lib/decisionLog.ts`**：轻量决策记录存储（localStorage）
- **`src/components/ProgressBar.tsx`**：10 阶段可视化进度条
- **`src/components/DevSpecPreview.tsx`**：DEV_SPEC 可折叠预览卡片
- **`src/components/CodexTaskPackPreview.tsx`**：CODEX_TASK_PACK 可折叠预览卡片
- **`src/components/ConfirmButton.tsx`**：带二次确认的确认按钮组件
- **`src/pages/DecisionOutputPage.tsx`**：10 阶段决策输出页，展示质量评分、歧义检测、范围控制、EARS 标准、DEV_SPEC、CODEX_TASK_PACK
- **`RESEARCH_REPORT.md`**：12 项目 + 10 方法论对标研究
- **`ARCHITECTURE_AUDIT.md`**：完整代码架构审计（127+ 文件、15 路由、13 localStorage keys）
- **`UPGRADE_PLAN.md`**：P0 升级方案与任务分解
- **`CHANGELOG.md`**：本文件
- **`ROADMAP.md`**：P0/P1/P2 路线图
- **`UPDATED_README.md`**：产品叙事升级版 README
- **`INTERVIEW_STORY.md`**：面试讲述材料

### Changed
- **`src/App.tsx`**：恢复 `/output/:id` 路由为 DecisionOutputPage（原为重定向到 handoff）
- **`src/components/StageLayout.tsx`**：新增 phases prop，支持 ProgressBar 渲染
- **`src/pages/DeveloperHandoffPage.tsx`**：底部新增 DEV_SPEC 和 CODEX_TASK_PACK 折叠区 + "查看决策输出"按钮
- **`src/pages/LandingPage.tsx`**：更新文案为 Vibe Decision Copilot 叙事，价值卡片更新

### Fixed
- 无历史 bug 修复。

### Deprecated
- `/output/:id` 重定向逻辑已移除。

### Not Done (P1/P2)
- 全自动代码生成
- 通用 Multi-Agent 框架
- 向量数据库
- 复杂 MCP Server
- 实时协作
- 登录系统
- 大规模 UI 重写
