# Vibe Decision Copilot

> **把模糊产品想法转化为 Codex 可执行任务包的前期决策 Agent**

---

## 项目定位

**不是普通 PRD 生成器。不是聊天机器人。不是简单表单。**

Vibe Decision Copilot 是一个面向 **vibe coding 初学者** 的前期决策 Agent。它的本质是在 AI 写代码之前，先把模糊想法变成**可判断、可收敛、可验收、可交给 Codex 执行**的规格说明。

## 用户问题

Vibe Coding 失败的本质，很多时候不是 AI 不会写代码，而是：

> 用户在没有想清楚"**做什么、为什么做、给谁做、做到什么程度算完成**"的情况下，就让 AI 开始写代码。

结果就是 AI 生成一堆好看的 Demo，但和用户真正需要的产品差了十万八千里。

## 核心闭环

```
Raw Idea
  → Problem Framing（问题框架）
  → User Scenario（用户场景）
  → Demand Evidence（需求证据）
  → MVP Scope（MVP 范围）
  → Risk Counterargument（风险反证）
  → Tech Constraints（技术约束）
  → Acceptance Criteria（验收标准）
  → DEV_SPEC（开发规格）
  → CODEX_TASK_PACK（Codex 可执行任务包）
```

## 为什么不是普通 PRD 生成器

| 普通 PRD 生成器 | Vibe Decision Copilot |
|---|---|
| 一次性生成 PRD 文档 | 10 阶段渐进式决策 |
| 无质量评分 | 8 维度需求质量评分 |
| 无歧义检测 | 5 类模糊表述识别 |
| 无范围控制 | P0/P1/P2/Out of Scope 控制 |
| 自由文本验收 | EARS 结构化验收标准 |
| 无 Codex 对接 | CODEX_TASK_PACK 直接可执行 |

## 功能模块

### 1. 10 阶段决策闭环
- 每个阶段有独立的状态追踪（empty / draft / needs_review / confirmed / blocked）
- 可视化进度条（10 阶段百分比）
- 阶段质量评分（0-5 分）
- 缺失信息识别 + 反问问题生成

### 2. 需求质量评分
8 维度本地规则评分（0-5 分/维度，总分 40 分）：
- **清晰度**（Clarity）：是否说清楚要做什么
- **具体性**（Specificity）：是否包含具体名词/数字/场景
- **用户证据**（User Evidence）：是否有用户/场景/需求证据
- **范围控制**（Scope Control）：是否有 P0/P1/P2/Out of Scope
- **可测试性**（Testability）：是否可验收
- **技术可行性**（Technical Feasibility）：是否定义了技术约束
- **风险意识**（Risk Awareness）：是否有反证和风险分析
- **Codex 可执行性**（Codex Executability）：是否能交给 Codex 执行

### 3. 需求歧义检测
- 模糊量词检测（"很多"、"一些"、"大部分"）
- 空洞形容词检测（"好用"、"智能"、"强大"）
- 泛词检测（"智能化"、"自动化"、"平台化"）
- 无边界范围检测（"所有用户"、"全平台"）

### 4. MVP 范围控制
- P0/P1/P2 功能分级
- Out of Scope 明确定义
- Scope Creep 预警（检测到登录/支付/团队协作等膨胀词时自动提醒）
- P0 数量收敛建议（≤5 个）

### 5. EARS 验收标准
5 种 EARS 模板：
- **Ubiquitous**：系统始终满足的行为
- **Event-driven**：事件驱动的响应
- **State-driven**：状态驱动的行为
- **Optional**：可选功能
- **Unwanted**：V1 明确不做的功能

### 6. DEV_SPEC（开发规格）
结构化输出：
- 产品目标、目标用户、用户场景
- P0/P1/P2 功能列表
- 数据实体、核心流程
- 验收标准（EARS 格式）
- 非功能需求、风险清单

### 7. CODEX_TASK_PACK（Codex 可执行任务包）
可直接交给 Codex CLI / Claude Code / Cursor 执行的指令包：
- 有序任务列表（含依赖关系）
- 文件创建计划
- 实现步骤
- 验收测试
- 进度清单（百分比）
- **禁止修改清单**（防止 Codex 擅自添加登录/数据库等功能）

## 技术栈

- **前端框架**: React 19 + TypeScript
- **构建工具**: Vite 6
- **样式方案**: Tailwind CSS v4 + 自定义设计 Token
- **状态管理**: React Hooks + localStorage
- **AI 集成**: Aliyun Qwen / OpenAI 兼容 API
- **Agent 运行时**: 自研 Agent V4 Graph Runtime（10 节点有状态图）
- **代码质量**: ESLint + TypeScript strict

## 项目结构

```
src/
├── types.ts                    # 核心类型定义（含 P0 新类型）
├── lib/                        # 工具库（P0 新增）
│   ├── requirementQuality.ts   # 需求质量评分
│   ├── ambiguityDetector.ts    # 歧义检测
│   ├── scopeControl.ts         # 范围控制
│   ├── ears.ts                 # EARS 验收标准
│   ├── devSpecBuilder.ts       # DEV_SPEC 构建器
│   ├── codexTaskPackBuilder.ts # CODEX_TASK_PACK 构建器
│   ├── decisionLog.ts          # 决策记录
│   └── progressCalculator.ts   # 进度计算
├── components/                 # 共享组件（P0 新增）
│   ├── ProgressBar.tsx         # 进度条
│   ├── DevSpecPreview.tsx      # DEV_SPEC 预览
│   ├── CodexTaskPackPreview.tsx # Task Pack 预览
│   └── ConfirmButton.tsx       # 确认按钮
├── pages/
│   ├── DecisionOutputPage.tsx  # 10 阶段决策输出页（P0 新增）
│   ├── DeveloperHandoffPage.tsx # 开发交付（P0 修改）
│   └── LandingPage.tsx         # 首页（P0 修改）
├── agent-v4/                   # Agent V4 Graph Runtime
├── spec/                       # 结构化 Spec
├── knowledge/                  # 轻量知识库
└── evaluation/                 # 本地评估引擎
```

## 运行方式

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 代码检查
npm run lint
```

## 面试讲述

### 核心叙事（30 秒）

> **我的项目不是普通 PRD 生成器，而是一个面向 vibe coding 的前期决策 Agent。**
>
> 它解决的问题是：很多人让 AI 写代码前，没有把需求、用户、范围、验收标准想清楚，导致 AI 生成玩具 Demo。
>
> 我的系统把模糊想法转成 Problem Framing → User Scenario → MVP Scope → Risk Counterargument → Acceptance Criteria → DEV_SPEC → CODEX_TASK_PACK，让 Codex 可以基于更稳定的规格执行。

### 技术亮点

1. **参考了 github/spec-kit 的四阶段流水线**（Specify → Plan → Tasks → Implement），设计了 10 阶段产品决策闭环
2. **借鉴 MetaGPT 的 SOP 理念**，将产品决策流程固化为结构化工作流
3. **引入 EARS 结构化需求语法**，让验收标准可测试、可自动化验证
4. **自研需求质量评分框架**，8 维度评分 + 问题识别 + 改进建议
5. **CODEX_TASK_PACK 设计**，参考 Codex CLI 的 AGENTS.md 机制，输出可直接执行的任务包

## 研究对标

本项目基于对 12 个 GitHub 开源项目和 10 个论文/方法论方向的深度研究，详见 `RESEARCH_REPORT.md`。

| 来源 | 核心机制 | 对本项目的启发 |
|------|---------|--------------|
| github/spec-kit | Spec→Plan→Tasks→Implement 四阶段 | 10 阶段闭环设计 |
| MetaGPT | 多角色 SOP 驱动（Code = SOP(Team)） | 阶段化工作流 |
| LangGraph | 有状态图 + Human-in-the-Loop | Agent V4 Runtime |
| EARS Syntax | 5 种需求模板 | 验收标准结构化 |
| LLM-as-a-Judge | AI 质量评估 | P1 升级方向 |

## License

MIT

---

> **Vibe Decision Copilot — 让 AI 辅助产品决策，而不是替代它**
