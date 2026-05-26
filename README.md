# VibePilot

> 面向 vibe coding 新手的 AI 产品构思 Copilot。

VibePilot 帮助用户在写代码前完成需求诊断、MVP 收敛、技术决策和开发交付。它不是传统问卷，也不是把一句话直接丢给 AI 编程工具，而是让 AI 先完成发散、推理和默认假设，用户只确认最核心的产品决策，最后输出可交给 Codex / Claude Code / Cursor 的 Development Prompt。

## 核心定位

很多 vibe coding 新手的问题不是不会让 AI 写代码，而是不知道：

- 这个需求是否真实？
- 第一版到底只做什么？
- 技术方案怎样才算够用？
- 怎么把方案交给 AI 编程工具开发？

VibePilot 的答案是：

> AI 先分析，用户做决策；默认看重点，需要时再展开详情。

## 四个决策关卡

前台体验压缩为 4 个注意力友好的关卡：

| 关卡 | 核心问题 | 产出 |
| --- | --- | --- |
| Idea Diagnosis / 想法诊断 | 这个需求是否值得继续？ | 需求证据、目标用户、产品判断、业务判断摘要 |
| MVP Decision / 第一版决策 | 第一版只验证哪个闭环？ | Must Have、Out of Scope、最小闭环、范围膨胀提醒 |
| Tech Decision / 技术决策 | 最低成本技术方案是什么？ | 技术翻译、Mock 策略、AI API 规则、升级条件 |
| Developer Handoff / 开发交付 | 是否可以交给 Codex 开发？ | Product Brief、技术架构、验收标准、Development Prompt |

后台仍保留完整 stages 数据：discovery、product、business、technical、mvp、blindSpot，用于生成更完整的交付文档和兼容旧项目。

## 关键功能

### 1. 核心决策优先

每个核心页面默认显示一个主决策：

- 当前用户只需要判断什么
- AI 推荐方案
- 一句话理由
- 最大风险
- 接受推荐 / 换一个更简单版本 / 为什么这样设计 / 展开详情

详细理由、风险列表、替代方案、术语解释和编辑内容默认折叠，避免信息过载。

### 2. Focus / Detail 视图

- Focus View：默认，只看核心决策和必要操作。
- Detail View：展开完整产品、业务、技术地图。

Quick Mode 和 Standard Mode 默认更偏 Focus；Review Mode 更适合查看风险和详情。

### 3. 三种使用模式

| 显示模式 | 底层模式 | 适合场景 |
| --- | --- | --- |
| Quick Mode：10 分钟出方案 | beginner | 只有一句模糊想法，想快速得到推荐路径 |
| Standard Mode：30 分钟认真构思 | builder | 已有基础想法，想更完整地整理方案 |
| Review Mode：审查已有方案 | review | 已有产品想法或草稿，想重点看风险和盲点 |

### 4. 新手解释层

内置术语解释，帮助新手理解：

- MVP
- Mock 策略
- 数据结构
- 数据流
- 后端
- 数据库
- 认证
- AI API
- 验收标准
- 价值假设
- ROI
- Out of Scope
- Scope Creep

### 5. AI 自定义接入

用户可以在设置页配置自己的：

- API URL
- API Key
- Model

调用路径：

```text
前端页面
→ 同源 /api/ai-proxy
→ 用户配置的 OpenAI-compatible API
```

生产环境必须成功连接 AI 模型后才能生成分析。Mock fallback 仅用于开发调试，不作为正式输出；如需本地调试 mock，必须在开发环境显式设置 `VITE_ENABLE_MOCK=true`。

### 6. 最终 Development Prompt

最终输出不是用户原文拼接，而是整合：

1. 产品目标
2. 目标用户
3. 需求洞察
4. 用户主流程
5. MVP 范围
6. 页面结构
7. 技术架构
8. 数据结构
9. Mock 策略
10. AI API 规则
11. 验收标准
12. Out of Scope
13. 风险与盲点
14. 禁止事项

AI API 规则必须写明：AI 不可用时必须停止生成并提示用户检查 API 配置，不允许输出 mock 结果冒充 AI 分析。

## V1.1 Knowledge-Enhanced Developer Handoff

V1.1 将 Developer Handoff 从“开发提示词生成器”升级为 knowledge-enhanced DEV_SPEC 生成器：

- 新增 `src/knowledge` 轻量知识库，内置案例、PRD 模板、架构模板和 Codex Prompt 模板。
- 新增规则检索函数，基于用户产品想法做 lightweight knowledge retrieval / pseudo-RAG。
- 新增 DEV_SPEC 输出，补充用户流程、页面结构、数据模型、AI 行为规则、风险和实现备注。
- 新增 Knowledge References，只展示引用文档的 title、type 和 reason，不暴露完整知识库内容。
- 新增 Evaluation Report，用本地规则评估 handoff 的清晰度、MVP 聚焦度、技术可执行性、验收完整度和 Prompt 可执行性。

当前版本不是完整 RAG：不包含数据库、向量数据库、Embedding、Rerank 或 MCP Server。后续可以升级为真正的 Modular RAG + MCP Server，但 V1.1 仍保持轻量、本地规则优先和无数据库依赖。

## V1.2 Explainable SPEC Generation

V1.2 在 V1.1 基础上进一步增强“为什么这样生成”的解释能力：

- 知识库新增中文 aliases 和 use cases，例如雅思、生词、错题、提示词评测、AI 客服、开发规格等中文关键词。
- 规则检索升级为可解释检索，返回 score、matched aliases、matched tags、matched fields 和引用 reason。
- Knowledge References 在页面中展示命中分数、命中关键词和引用理由，帮助用户理解知识如何影响生成结果。
- Evaluation Report 增加每个维度的 evidence、issues、suggestions，不只给总分。
- 新增本地 localStorage Generation Trace，记录最近 handoff 生成的引用文档、评分、readiness 和问题数量。

当前仍不是完整 RAG：不包含向量数据库、Embedding、Rerank、MCP Server 或数据库。V1.2 仍然是 lightweight knowledge retrieval / pseudo-RAG，用于解释化规格生成。

## V1.3 SPEC Quality Loop

V1.3 将 Developer Handoff 从“生成 + 评分”升级为 SPEC Quality Loop：

- 检索增加 stopwords 和最低相关度分数，减少空输入、泛词和短中文切词导致的误命中。
- Knowledge References 增加 appliedTo 和 influence，说明知识文档影响了哪些输出区块以及具体影响方式。
- Codex Prompt Template 已接入最终 Development Prompt，并追加 Codex Execution Wrapper、约束和验证命令。
- DEV_SPEC 升级为 structured spec + markdown formatter，优先生成结构化页面、数据模型、AI 行为规则和风险。
- Evaluation 增加 fixSuggestions，指出可执行本地修复 patch。
- Developer Handoff 支持 Apply Local Fixes，一键把 patch 追加到对应区块并重新评分。
- Generation Trace 支持 score delta、readiness change 和 fixed issue count，用于对比修复前后的质量变化。

当前仍不是完整 RAG：不包含向量数据库、Embedding、Rerank、MCP Server 或数据库。

## V1.4 Reliability & Demo Readiness

V1.4 聚焦可靠性、迁移、评分可信度和演示可验证性：

- 新增 `schemaVersion`，新生成 handoff 标记为 `v1.4`，旧 handoff 会按缺失字段自动升级。
- 修复 Structured DEV_SPEC fallback，避免空数组导致 DEV_SPEC 区块空白。
- Evaluation 增加结构证据评分，短空话即使命中关键词也不能轻易拿高分。
- Fix Suggestions 更具体，按缺失的 Must Have、Out of Scope、数据模型、测试命令等生成 patch。
- Apply Local Fixes 返回 changed 状态，重复点击不会重复追加 patch，也不会写无意义 trace。
- Trace 增加 appliedFixIds、remainingIssues、summary，便于展示修复前后质量变化。
- 新增 Retrieval Self Check，用 4 个样例验证轻量检索是否误命中。
- Markdown 导出增加 schemaVersion、readiness、score、knowledge reference 数量和生成时间。

当前仍不包含数据库、向量数据库、Embedding、Rerank 或 MCP Server。

## V1.5 Case Study & Benchmark Mode

V1.5 面向作品集和面试展示增强：

- 新增 Handoff Snapshot，用 localStorage 保存最近生成与修复版本。
- 新增 Quality Compare，对比最近两次 snapshot 的 score、readiness、changed sections 和 appliedFixIds。
- 新增 Case Study Export，可导出包含 input idea、retrieved knowledge、DEV_SPEC、evaluation、applied fixes、quality change 和 final prompt 的 Markdown 案例。
- 新增 Demo Sample 展示，覆盖雅思生词错题、PromptEval Lab、AI 客服质检和股票投资复盘四类演示输入。
- Evaluation 增加 weighted score，突出技术可执行性和 Prompt 可执行性的权重。
- 新增 Structured Spec Preview，快速预览 DEV_SPEC 中的项目概览、MVP、数据模型、验收标准和风险。
- 修复 React Hooks lint warnings，`npm run lint` 可达到 0 warnings。

当前仍不包含数据库、向量数据库、Embedding、Rerank 或 MCP Server。

## Portfolio Story

### Problem

AI Coding 失败往往不是因为模型不会写代码，而是因为前置产品规格不清楚：目标用户、MVP、数据模型、验收标准和开发约束都不明确。

### Solution

Vibe Copilot 把模糊产品想法转化为 Product Brief、MVP Scope、DEV_SPEC、Codex Development Prompt，并通过 Knowledge References、Evaluation、Fix Suggestions 和 Trace 形成质量闭环。

### Why It Is Different

普通 Prompt 工具只生成文本；本项目能够解释引用了哪些知识、评分哪里不足、如何本地修复，并导出完整 Case Study。

### Future Roadmap

- 知识库规模扩大后接入真正 Embedding + Rerank
- 当需要被 Claude / Codex 直接调用时封装 MCP Server
- 当需要跨设备和团队协作时再接数据库和账号系统

## Interview Talking Points

### 1. 为什么第一版不用向量数据库？

当前知识库规模小，优先验证“知识增强生成 + 质量闭环”。规则检索更可控、可解释、低成本，也更适合展示每个引用为什么被选中。

### 2. 这个项目和普通 Prompt 生成器有什么区别？

普通 Prompt 工具只生成文本；本项目有 Knowledge References、DEV_SPEC、Evaluation、Fix Suggestions 和 Trace，形成生成、评分、修复、再评分的质量闭环。

### 3. Evaluation 怎么设计？

从用户场景、MVP 聚焦、技术可执行性、验收完整度、Prompt 可执行性五个维度评分，并输出 evidence、issues、suggestions、fixSuggestions。

### 4. Apply Local Fixes 解决什么问题？

它把评测建议从“自然语言建议”变成可执行 patch，让系统能从生成进入评分、修复、再评分闭环。

### 5. 后续如何升级成真正 RAG / MCP？

当知识库规模扩大后接 Embedding + Rerank；当需要让 Claude / Codex 直接调用时，再封装 MCP Server。

## 技术栈

- React 19
- Vite 8
- TypeScript 6
- React Router v6
- Tailwind CSS v4 / 自定义 CSS Components
- lucide-react
- localStorage
- Vercel / API proxy

## 快速开始

### 安装依赖

```bash
npm install
```

### 本地开发

```bash
npm run dev
```

访问：

```text
http://localhost:5173
```

### 构建生产版本

```bash
npm run build
```

### 预览生产版本

```bash
npm run preview
```

## Packaging Source Code

提交或打包源码时不要包含：

- `node_modules`
- `dist`
- `.git`
- `__MACOSX`
- `.DS_Store`

推荐命令：

```bash
zip -r vibe-copilot-source.zip . \
  -x "node_modules/*" "dist/*" ".git/*" "__MACOSX/*" "*.zip" ".DS_Store"
```

## 项目结构

```text
vibepilot/
├── api/
│   └── ai-proxy.ts                 # Vercel AI 代理
├── src/
│   ├── api/
│   │   └── evaluate.ts             # API 调用、AI 状态检查、导出函数
│   ├── components/
│   │   ├── DecisionCard.tsx        # 核心决策卡片
│   │   ├── SuggestionCard.tsx      # 详情建议卡片
│   │   ├── GlossaryHelp.tsx        # 术语解释
│   │   └── StageLayout.tsx         # 四关卡页面布局
│   ├── data/
│   │   └── glossary.ts             # 新手术语解释数据
│   ├── hooks/
│   │   └── useProductBrief.ts      # brief 存储、迁移与更新
│   ├── pages/
│   │   ├── NewIdeaPage.tsx         # 输入想法与模式选择
│   │   ├── DemandDiscoveryPage.tsx # Idea Diagnosis
│   │   ├── MvpScopePage.tsx        # MVP Decision
│   │   ├── TechnicalPlanningPage.tsx # Tech Decision
│   │   └── DeveloperHandoffPage.tsx # Developer Handoff
│   ├── prompts/                    # 模型提示词构造
│   ├── rules/                      # 核心决策提取规则
│   ├── skill/                      # 产品构思规则、质量门与示例
│   └── types.ts                    # TypeScript 类型
└── vite.config.ts                  # 本地 /api/ai-proxy middleware
```

## V1 明确不做

- 登录
- 支付
- 数据库
- 团队协作
- 完整 SaaS 后台
- 自动代码生成
- 复杂项目管理系统

## License

MIT
