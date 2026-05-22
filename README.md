# VibePilot 🚀

> **教 Vibe Coding 新手学会产品思维的训练工具**

不是帮你填表，而是教你**如何思考**——像产品经理一样思考。

## ✨ 核心理念

**问题**：很多 vibe coding 新手能写出代码，但做不出真正的产品。  
**原因**：他们从未认真思考过「为谁解决什么问题」。

**VibePilot 的答案**：不直接给答案，而是通过 **引导 + 评价 + 追问 + 反例对比**，让你真正学会产品思维。

## 🎯 适合谁用？

- 刚接触 vibe coding，想做出「能用的产品」而非「玩具 Demo」
- 对产品思维、业务思维、技术思维不敏感
- 写完代码发现「好像没人需要这个功能」

## 🧠 核心功能

### 1️⃣ 10 步产品思考引导

| 步骤 | 思考问题 | 为什么重要 |
|------|---------|-----------|
| 1 | 目标用户是谁？ | 不知道为谁做，就等于为所有人做（= 没人用） |
| 2 | 使用场景是什么？ | 场景越具体，功能越聚焦 |
| 3 | 核心痛点是什么？ | 痛点不痛 = 产品没价值 |
| 4 | 现有替代方案？ | 竞品分析 → 找到差异化 |
| 5 | AI 是否必要？ | 避免「为了 AI 而 AI」 |
| 6 | MVP 功能范围？ | 第一个版本只做最核心的 |
| 7 | 暂时不做的功能？ | 克制 = 更清晰的产品边界 |
| 8 | 技术架构？ | 技术选型影响开发效率 |
| 9 | 数据结构？ | 数据模型 = 产品的骨架 |
| 10 | 验收标准？ | 不知道怎么验收 = 做不完 |

### 2️⃣ AI 评价系统

你写完每个步骤的答案后，AI 会：
- ✅ **评价质量**：具体 / 还行 / 太模糊
- 💬 **追问引导**：帮你发现思考漏洞
- 📝 **反例对比**：展示「好答案 vs 坏答案」

> **关键设计**：AI 不替你写答案，只评价你的答案。

### 3️⃣ 生成 Development Prompt

完成 10 步思考后，一键生成**可直接用于 vibe coding 的 Development Prompt**，包含：
- 项目背景
- 功能需求
- 技术栈建议
- 数据结构设计
- 验收标准

## 🛠️ 技术栈

- **框架**：React 18 + TypeScript
- **构建工具**：Vite
- **样式**：Tailwind CSS v4
- **路由**：React Router v6
- **图标**：Lucide React
- **持久化**：localStorage
- **部署**：GitHub Pages (自动)

## 🚀 快速开始

### 安装依赖
```bash
npm install
```

### 本地开发
```bash
npm run dev
```
访问 `http://localhost:5173`

### 构建生产版本
```bash
npm run build
```

### 预览生产版本
```bash
npm run preview
```

## 📁 项目结构

```
vibepilot/
├── src/
│   ├── pages/          # 页面组件
│   │   ├── LandingPage      # 落地页
│   │   ├── NewIdeaPage     # 输入想法
│   │   ├── GuidePage       # 10 步引导（核心）
│   │   ├── PreviewPage     # 预览 Product Brief
│   │   └── OutputPage      # 生成 Development Prompt
│   ├── data/
│   │   └── steps.ts        # 10 步定义
│   ├── hooks/
│   │   └── useProductBrief.ts  # 数据持久化
│   ├── api/
│   │   └── evaluate.ts     # AI 评价逻辑（V1 使用 mock）
│   └── types.ts            # TypeScript 类型定义
├── public/               # 静态资源
└── .github/workflows/   # GitHub Actions 自动部署
```

## 🎨 设计系统

VibePilot 使用 **CSS Component 系统**（`src/index.css`），包括：
- `.vp-btn` - 按钮
- `.vp-card` - 卡片
- `.vp-textarea` - 文本域
- `.vp-collapse` - 折叠面板
- `.vp-quality-badge` - 质量标签
- 支持 **Dark/Light** 模式

## 🔮 后续计划

- [ ] 接入真实 AI API（OpenAI / Claude）
- [ ] 支持多语言（中/英）
- [ ] 用户账号系统（保存历史 Brief）
- [ ] 社区分享（看看别人怎么思考的）
- [ ] VibeCoding 模式（边做边学）

## 📄 许可证

MIT License

## 🙏 致谢

给所有想做出「真正产品」的 vibe coding 新手 ✊

---

**Made with ❤️ by VibePilot Team**