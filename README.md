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

没有配置模型或模型调用失败时，会自动使用 mock fallback，保证产品流程可体验。

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

## 项目结构

```text
vibepilot/
├── api/
│   └── ai-proxy.ts                 # Vercel AI 代理
├── src/
│   ├── api/
│   │   └── evaluate.ts             # API 调用、fallback 调度、导出函数
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
