# VibePilot 设计系统 v2.0

> iOS-inspired Glassmorphism · Coral × Navy × Sage

---

## 🎨 色彩体系

| 令牌 | 色值 | 用途 |
|---|---|---|
| `--vp-coral` | `#E04A3B` | 主色调 CTA / 强调 |
| `--vp-coral-soft` | `#F5D5CF` | 珊瑚浅色 |
| `--vp-coral-light` | `#FDF2EF` | 珊瑚背景 |
| `--vp-navy` | `#1E3A4C` | 标题 / 深色 |
| `--vp-navy-soft` | `#3A5566` | 次级文字 |
| `--vp-navy-light` | `#E8EDF1` | 海军蓝背景 |
| `--vp-sage` | `#95A89B` | 成功 / 辅助色 |
| `--vp-cream` | `#F5F0EA` | 暖色背景 |
| `--vp-warm-white` | `#FDFBF8` | 纯暖白 |

**渐变文字公式**：`linear-gradient(135deg, #E04A3B, #D44236, #3A5566)`

---

## 🫧 玻璃拟态系统

| 层级 | blur | saturate | 用途 |
|---|---|---|---|
| `--glass-blur-sm` | 12px | 1.6 | 小元素 / 输入框 |
| `--glass-blur-md` | 24px | 1.5 | 卡片 (默认) |
| `--glass-blur-lg` | 40px | 1.4 | 大面板 |
| `--glass-blur-xl` | 60px | 1.3 | 导航栏 |

**核心参数**：
- 玻璃边缘：`rgba(255,255,255,0.72)` 边框
- 内高光：`inset 0 1px 0 rgba(255,255,255,0.8)`
- 卡片背景：`linear-gradient(135deg, rgba(255,255,255,0.72), rgba(245,240,234,0.40))`

---

## 📐 圆角曲线 (iOS 风格)

| 令牌 | 数值 | 适用场景 |
|---|---|---|
| `--radius-xs` | 6px | 小图标容器 |
| `--radius-sm` | 10px | 迷你组件 |
| `--radius-md` | 14px | 图标背景 |
| `--radius-lg` | 20px | 输入框 (新默认) |
| `--radius-xl` | 28px | 卡片 |
| `--radius-2xl` | 36px | 大容器 |
| `--radius-full` | 9999px | 胶囊按钮 |

---

## 🎬 动效规范

| 缓动 | 用途 |
|---|---|
| `cubic-bezier(0.32, 0.72, 0, 1)` `300ms` | 默认过渡 |
| `cubic-bezier(0.22, 0.98, 0.31, 1.02)` `300ms` | 弹性悬停 |
| `80ms` 快切 | 按下状态 |

**悬停标准**：`translateY(-2px)` + 阴影加深
**按下标准**：`scale(0.975)` + 阴影减淡

---

## 🧩 组件速查

### 玻璃卡片
```html
<div class="vp-card">...</div>
```
- 24px 模糊 + 1.5 饱和度
- 内高光渐变叠加
- 悬停上浮 2px

### 主按钮
```html
<button class="vp-btn vp-btn-primary">文字</button>
```
- 珊瑚红渐变：`#E04A3B → #D44236`
- 悬停阴影发光：`rgba(224,74,59,0.36)`
- 胶囊形

### CTA 按钮
```html
<button class="vp-btn-cta">开始 <ArrowRight /></button>
```
- 16px 字号 / 36px 横向 padding
- 更大发光阴影

### 输入框
```html
<textarea class="vp-textarea" />
<input class="vp-input" />
```
- 20px 圆角
- 聚焦状态：珊瑚色 border + 4px 外发光环

### 步骤导航
```html
<button class="vp-step-btn vp-step-btn-active">...</button>
```
- 已完成：绿色 + 勾号
- 当前：珊瑚色 + 渐变背景
- 待完成：灰色文字

---

## 🌈 背景系统

动态多层径向渐变：
1. 暖奶油底：`#FDFBF8 → #F5F0EA → #F3F1ED`
2. 鼠尾草大圆 (右上)：`rgba(149,168,155,0.20)`
3. 海军蓝大圆 (左下)：`rgba(30,58,76,0.08)`
4. 珊瑚暖圆 (中间)：`rgba(224,74,59,0.05)`

漂浮光球 (CSS animation)：
- `.vp-orb--coral`：500px 珊瑚球，22s 漂移动画
- `.vp-orb--navy`：420px 海军蓝球，20s
- `.vp-orb--sage`：380px 鼠尾草球，24s

---

## ♿ 无障碍

- 所有文字对比度 ≥ 4.5:1
- 悬停态独立于颜色识别（阴影 + 位移）
- 焦点环：4px `rgba(224,74,59,0.08)` 外发光
- 禁用态：`opacity: 0.45` + `pointer-events: none`

---

**设计日期**：2026-05-27
**设计师**：UI Designer (AI)
**参考**：iOS 设计规范 · Glassmorphism · 色卡 #E04A3B / #1E3A4C / #95A89B
