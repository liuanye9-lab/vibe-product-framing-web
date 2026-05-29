# V4.6 Liquid Glass Visual System Upgrade Report

> **版本**: Vibe Decision Copilot V4.6  
> **日期**: 2026-05-29  
> **目标**: 将视觉系统从 Coral/Navy/Sage 功能型工具页面升级为 iOS Liquid Glass AI 产品作品集

---

## 1. 设计目标

| 维度 | 升级前 (V4.5) | 升级后 (V4.6) |
|------|-------------|-------------|
| 色系 | Coral/Navy/Sage 三色 | iOS Blue/Indigo/Purple 系统色 |
| 材质 | 玻璃拟态（已有） | Liquid Glass + 饱和增强 + 内阴影 |
| 暗色模式 | 不支持 | 完整 prefers-color-scheme: dark |
| 动效 | 基础 transition | Cubic-bezier 系统缓动 + scale/hover |
| 响应式 | 基础 | 640px 断点适配 |
| 可访问性 | 无 | prefers-reduced-motion + prefers-contrast + backdrop-filter fallback |
| 组件库 | 内联组件 | 10 个 Liquid 组件统一导出 |
| 页面叙事 | Hero + 3 Cards | Hero + Core Loop + Why Not PRD + Interview |

---

## 2. 参考来源

- Apple Human Interface Guidelines (color system, spacing, typography)
- iOS 26 / Liquid Glass 视觉语言
- macOS Tahoe / visionOS 设计模式
- iOS system colors (SF Symbols palette)
- Apple accessibility guidelines (reduce motion, increase contrast)

> 注：本轮升级基于已知 Apple HIG / iOS / macOS 设计原则进行保守实现。

---

## 3. 色彩系统

### Light Mode
```
--vp-blue:    #007aff    Primary actions
--vp-indigo:  #5856d6    Secondary accent
--vp-purple:  #af52de    Tertiary accent
--vp-cyan:    #32ade6    Info / links
--vp-mint:    #00c7be    Success alt
--vp-green:   #34c759    Success
--vp-orange:  #ff9500    Warning
--vp-red:     #ff3b30    Error
```

### Background
```
Light:  #f5f7fb → #f0f4fb gradient + blue/indigo/purple aurora orbs
Dark:   #080b12 → #0d1220 gradient
```

### Semantic Mapping
```
--color-primary:   #007aff (was #E04A3B)
--color-accent:    #5856d6 (was #1E3A4C)
--color-success:   #34c759 (was #4A9C81)
--color-warning:   #ff9500 (was #D4883C)
--color-danger:    #ff3b30 (was #C0392B)
```

---

## 4. 玻璃材质系统

### vp-liquid-card (新增)
```css
background: var(--vp-bg-glass);
backdrop-filter: saturate(180%) blur(24px);
border: 1px solid var(--vp-border-glass);
box-shadow: var(--vp-shadow-glass), var(--vp-shadow-inner);
border-radius: var(--vp-radius-lg); /* 24px */
```

### 旧 class 兼容
- `.vp-glass` / `.vp-card` 保留，映射到新色系
- 所有旧页面组件继续正常工作

### Fallback
```css
@supports not (backdrop-filter: blur(12px)) {
  .vp-card, .vp-glass, .vp-liquid-card {
    background: rgba(255,255,255,0.92);
  }
}
```

---

## 5. 动效系统

| 动效 | 实现 | 时长 |
|------|------|------|
| 页面进入 | opacity 0→1 + translateY 8→0 | 320ms cubic-bezier |
| 卡片 hover | translateY(-2px) + shadow 加深 | 220ms |
| 按钮 active | scale(0.985) | 140ms |
| Progress fill | width 动画 | 500ms |
| Thinking dots | opacity pulse | 连续 |

### 可访问性
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 6. 组件库 (src/components/liquid/)

| 组件 | 用途 |
|------|------|
| AuroraBackground | 全屏 aurora 光晕背景 + 噪点层 |
| LiquidShell | macOS 风格应用外壳 |
| LiquidCard | 玻璃卡片（hover 浮起） |
| LiquidButton | iOS 风格 pills 按钮 |
| LiquidInput | 玻璃 textarea（聚焦 glow） |
| LiquidBadge | 状态 pills（blue/green/red/orange/purple） |
| LiquidProgress | 渐变进度条 + 百分比 |
| LiquidStepRail | 10 阶段横向指示器 |
| LiquidDock | 浮动底部操作栏 |
| PageReveal | 页面入场动画包装器 |

---

## 7. 页面升级详情

### LandingPage
- Hero: "Vibe Decision Copilot" + 副标题 + 玻璃胶囊流程
- Core Loop: LiquidStepRail 10 阶段
- Why Not PRD: 3 张对比 LiquidCard
- Interview-Ready: 面试讲述卡片
- CTA: 开始构思 / 查看历史 / 配置 API

### NewIdeaPage
- iOS onboarding 风格
- 大号玻璃 textarea + iOS segmented 模式选择
- LiquidBadge API 状态

### AgentWorkspacePageV4
- macOS titlebar + 红黄绿 traffic lights
- "Agent Decision OS V4.6"
- 蓝色半透明用户气泡 / 白色玻璃 Agent 气泡
- AI call 状态 chip
- macOS Spotlight 风格输入区
- 右侧玻璃侧边栏 + segmented tabs

### DecisionOutputPage
- Hero: "Decision Output — 从模糊想法到 Codex Task Pack"
- 8 维度质量评分 LiquidCard 网格
- EARS / DEV_SPEC / CODEX_TASK_PACK 独立卡片

### DeveloperHandoffPage
- 所有 section 使用 LiquidCard
- macOS 风格代码块 (vp-mac-code)

### SettingsPage
- 居中玻璃面板
- API Status glow card
- LiquidBadge presets

### HistoryPage
- "Recent Decision Specs"
- LiquidCard 项目列表

---

## 8. 可访问性处理

- ✅ `prefers-reduced-motion: reduce` — 禁用所有动画
- ✅ `prefers-contrast: more` — 增强背景不透明度
- ✅ `@supports not backdrop-filter` — fallback 实色背景
- ✅ 所有状态用文字 + 颜色双重表达
- ✅ focus-visible 样式保留
- ✅ icon-only buttons 有 title/aria-label

---

## 9. 文件变更统计

| 操作 | 数量 | 文件 |
|------|------|------|
| 修改 | 11 | index.css, LandingPage, NewIdeaPage, AgentWorkspacePageV4, DecisionOutputPage, DeveloperHandoffPage, SettingsPage, HistoryPage, IMPLEMENTATION_LOG, CHANGELOG, ROADMAP |
| 新增 | 12 | 10 个 liquid 组件 + index.ts + VISUAL_UPGRADE_REPORT.md |
| 未动 | 130+ | Agent Runtime, API, hooks, 旧四步流程页面, types |

---

## 10. 后续可优化方向

- [ ] 组件逐步迁移：将旧页面中的内联卡片替换为 Liquid 组件
- [ ] 动画微调：Thinking bubble shimmer、Aurora orbs 动态
- [ ] 移动端深度优化：Agent 双栏转底部 sheet
- [ ] 性能优化：用 CSS containment 优化 backdrop-filter 重绘
- [ ] 国际化：支持英文 UI
