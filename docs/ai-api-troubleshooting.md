# Vibe Copilot AI API 接入问题排查与修复手册

> 本文档记录项目从初始部署到稳定运行过程中，所有 AI API 接入相关的报错、根因和修复方案。  
> 下次遇到类似问题时，按本文档的「错误现象 → 排查步骤 → 修复方案」流程处理。

---

## 问题全景图

AI API 接入报错不是单一原因，而是**多层叠加**：网络层 → 代理层 → 解析层 → 校验层 → 渲染层。修复顺序是从底层往上逐层加固。

```
用户看到: "大模型生成失败" / "页面加载出错"

可能的原因层次 ──────────────
  网络层: fetch 失败、超时、代理不可达
  代理层: timeout 硬编码导致长任务被截断
  解析层: LLM 返回非标准 JSON（围栏/注释/截断/包裹）
  校验层: 引用校验误杀有效输出
  缓存层: 修改 prompt 后仍命中旧缓存
  渲染层: 对象被直接渲染为 React child
```

---

## 修复清单（按时间顺序）

### Bug #1 — JSON 解析失败

**现象**: `模型返回格式错误，未找到有效 JSON`

**根因**:
- `extractJson()` 使用贪婪正则 `/\{[\s\S]*\}/`，遇到以下情况失败：
  - LLM 用 \`\`\`json ... \`\`\` 包裹
  - 非 OpenAI 模型输出尾部逗号
  - JSON 中包含注释
  - 花括号嵌套时匹配到错误的闭合括号

**修复** (`087fecd`):
- 重写为「花括号深度计数算法」(`findBalancedBraces`)
- 新增 4 个辅助函数：`stripMarkdownFences` / `stripComments` / `removeTrailingCommas`
- 构建 8 策略降级管线（后续升级到 8 策略）
- 强化所有 prompt 的输出格式要求

---

### Bug #2 — Failed to fetch

**现象**: `大模型生成失败：Failed to fetch`

**根因**:
1. fetch 无重试机制——一次网络抖动 = 永久失败
2. 错误信息只是 `"Failed to fetch"`，零诊断线索
3. `vercel.json` 的 SPA catch-all 可能拦截 `/api/*` 路由
4. 无连接预检，不知道代理是否可达

**修复** (`7b82d1e`):
- **3 次重试 + 指数退避** (1s → 2s → 3s)，区分可重试/不可重试错误
- **`classifyNetworkError()`** 6 类分类器：NETWORK_FAILURE / TIMEOUT / CORS / SSL / UPSTREAM_UNAVAILABLE / UNKNOWN
- **`checkProxyReachable()`** OPTIONS 预检，确认 `/api/ai-proxy` 可达
- **`vercel.json`** 增加 `/api/(.*)` 显式路由 → 确保 Edge Function 不被 SPA 拦截

---

### Bug #3 — 模型输出被截断

**现象**: Vercel 线上环境，JSON 输出在半截断掉（如 `"whyNoBackend":{`）

**根因**:
- 所有阶段统一使用 `maxTokens=850`
- `technical` 阶段有 15+ 字段，远超 850 tokens 预算
- 模型输出到一半被 max_tokens 截断 → JSON 花括号不闭合

**修复** (`46a5bd1`):
- **按阶段分配 token 预算**: discovery:900, product:1000, business:1200, **technical:2400**, mvp:1400, blindSpot:1300
- 新增 `attemptTruncatedJsonRecovery()` — 逐字符扫描，自动补全未闭合的字符串/数组/对象括号
- 新增 `detectTruncationHint()` — 错误消息报告具体未闭合数量
- 管线从 6 策略扩展到 8 策略

---

### Bug #4 — React Error #31 页面崩溃

**现象**: 页面显示「页面加载出错」

**根因**: React Error #31 不是 Hook 问题，而是 **"Objects are not valid as a React child"**。
`DeveloperHandoffPage.tsx` 12 处将 `finalHandoff` 动态字段直接渲染为 JSX child。
localStorage 旧数据中字段值为对象（如 `{value: "xxx"}`）导致 React 崩溃。

**修复** (`dea20e4`):
- 所有危险渲染点加 `toDisplayText()` / `toDisplayList()` 保护
- `useProductBrief.saveFinalHandoff` 写入前过 `normalizeFinalHandoff`
- 受影响组件：KnowledgeReferencesCard / KeywordRow / EvaluationReportCard / FixSuggestionsList / EvaluationDimensionCard / EvaluationList

---

### Bug #5 — 「AI 输出没有基于当前产品想法」误报

**现象**: 用户只填了 `rawIdea`，triggering 100% 误报

**根因**: `assertAIOutputReferencesInput` 硬编码 `referencedCount < 2`。
用户只填 rawIdea → fields 只有 1 条 → 永远达不到 2 → 必失败。

**修复** (`e4f1791`):
- 改为 `minRequired = Math.min(2, fields.length)` — 1 字段时匹配 1 即可
- 过滤 `normalizeForReference` 后为空的字段

---

### V1.6 — AI Reliability Patch（系统性加固）

**6 个根因一并修复** (`7a6b6c2`):

| # | 问题 | 修复 |
|---|------|------|
| 1 | 代理层 timeout 硬编码 90s，Handoff 180s 请求被提前中断 | `api/ai-proxy.ts` + `vite.config.ts` 支持动态 `timeoutMs` (10s-240s) |
| 2 | 所有错误都显示「大模型生成失败」 | `VibeAIError` 类 + 6 种错误类型 + `getAIErrorMessage()` |
| 3 | 引用校验太粗暴（字面匹配 + 硬阈值） | `validateAIOutputReferencesInput()` 加权评分 |
| 4 | Prompt 无结构化引用证据 | 所有 prompt 增加 `referenceEvidence` 顶层字段 |
| 5 | 改 prompt 后仍命中旧缓存 | cache key 加入 `hash(systemPrompt)` |
| 6 | 有效 JSON 但引用偏弱直接被丢弃 | salvage 逻辑：保留有效输出 + 标注 `validationWarnings` |

---

### V1.7 — Fast MVP Decision Patch

**现象**: 第二步 MVP Decision 频繁超时

**根因**: MVP 阶段使用完整 `buildBriefContext()` + 重型 `buildSuggestStagePrompt()` + 120s timeout。上下文和 prompt 过重，模型处理慢。

**修复** (`6094ad9`):
- **压缩上下文**: `buildCompactStageContext('mvp')` 只传 ideaInput + productSummary + demandSummary
- **轻量 prompt**: `buildMvpScopePrompt()` 无技术规则/翻译示例
- **快速通道**: max_tokens 900 + timeout 75s
- **预填本地草案**: 进入页面即填 `buildLocalMvpSuggestions()`，不等待 AI
- **AI 超时 fallback**: 返回 local-rule 草案而不阻断流程

---

### Settings 长 JSON 测试误判修复

**现象**: 测试显示「缺少关键字段」，但实际模型只是返回了 `"..."`

**根因**:
- 测试 prompt 使用 `"..."` 占位符 → 模型照抄省略号
- JSON 解析手写 `JSON.parse`，不复用 8 策略管线
- `devSpec` 校验缺失（代码只查了 productBrief/mvpScope/developmentPrompt）
- Required Fields 和 Reference Validation 混为一谈

**修复** (`2dee890`):
- Prompt 改用真实示例 + 明确要求 ≥30 中文字符
- 复用 `extractJson()` + `validateAIOutputReferencesInput()`
- 拆为 4 层独立展示：API Connection / JSON Parse / Required Fields / Reference Validation
- `isUsefulString()` 自动拒绝 `"..."` / `"N/A"` / 空串

---

### JSON 解析容错最后加固

**现象**: 模型返回了有效 JSON 但被 `result/data/output` 包裹，解析失败

**根因**:
- `extractJson()` 无 unwrap 能力
- `mvpScopePrompt` 仍有 `"..."` 占位符
- MVP 只有 timeout fallback，json_parse 直接抛错阻断流程

**修复** (`f140f78`):
- `unwrapJsonPayload()` 处理 6 种包裹：`{result:{}}`, `{data:{}}`, `{output:{}}`, `{content:"..."}`, `{message:{content:"..."}}`, `[{}]`
- MVP fallback 扩展到 `json_parse` / `empty` / `validation`（原来是 timeout-only）
- `annotateLocalFallbackReason()` 标注失败原因
- 非 MVP 阶段 json_parse 失败后自动 retry 1 次（stricter prompt）
- 增强诊断：检测 fence / preamble / brace-mismatch / array

---

## 快速排查指南

当看到某个错误时，按以下路径排查：

### 1. 报错「API 连接失败」/「Failed to fetch」

```
排查步骤:
├── 检查浏览器控制台 [VibePilot] AI Proxy Request 日志
├── 确认 /api/ai-proxy OPTIONS 可达（打开 DevTools Network 面板）
├── Settings → 测试连接（短）→ 是否通过？
├── 检查 API URL 格式：必须以 /chat/completions 结尾，或基础地址
├── 检查 API Key 是否有余额
└── Vercel 部署是否成功（检查 Deployments 页面）
```

### 2. 报错「模型响应超时」

```
排查步骤:
├── Settings → 测试长 JSON 生成 → 是否超时？
├── 控制台 [VibePilot] MVP fast request timeoutMs 是否合理（75s-180s）
├── 模型本身是否响应慢（高峰期/免费额度耗尽）
├── 切换到更快模型（如 deepseek-chat / gpt-4o-mini）
└── 如果 MVP 阶段超时 → 应自动 fallback local-rule，不应卡死
```

### 3. 报错「模型返回格式错误，未找到有效 JSON」/ json_parse

```
排查步骤:
├── 控制台 [VibePilot] JSON extraction failed 日志 → 查看 raw content 前 500 字
├── containsBrace: false → 模型没输出花括号
├── hasFence: true → 模型用了 \`\`\` 围栏（已被 8 策略管线处理）
├── hasPreamble: true → 模型有「以下是 JSON」等解释文字
├── brace mismatch → 模型输出被截断（检查 max_tokens 预算）
├── hasArray: true → 模型返回了数组而非对象（unwrapJsonPayload 处理）
└── MVP 阶段 → 应该自动 fallback local-rule，如果仍阻断则检查 suggestStage
```

### 4. 报错「模型已响应，但输出与当前产品想法关联不足」

```
排查步骤:
├── 控制台 [VibePilot] Validation salvage 日志 → 查看 matchedFields / missingFields
├── 用户在 NewIdeaPage 填了什么字段？rawIdea 是否太短？
├── projectType 太短会被自动豁免
├── referenceEvidence 字段是否存在？
└── 如果 key 字段都有 → salvage 逻辑应保留输出 + 标注 warning
```

### 5. 页面「页面加载出错」

```
排查步骤:
├── 控制台 [VibePilot] Render error 日志
├── 检查 localStorage 中 vibepilot_briefs 数据格式
├── 确认所有动态渲染用 toDisplayText() 包裹
├── npm run build 是否通过
└── 清除 localStorage 重新测试
```

### 6. MVP 阶段卡死/无响应

```
排查步骤:
├── 进入页面是否立即显示本地草案？（应该）
├── 按钮文字是「AI 优化范围建议」还是「重新生成范围建议」？
├── 点击 AI 优化后控制台 [VibePilot] MVP fast request 日志
├── 如果 AI 超时/json_parse 是否自动 fallback？
└── mustHave.source 是否为 'local-rule'？（fallback 标识）
```

---

## 架构决策记录

| 决策 | 理由 |
|------|------|
| 不做向量数据库/Embedding/Rerank | V1 知识库小，规则匹配更可控可解释 |
| 不做数据库 | 单用户本地构思工具，localStorage 足够 |
| AI 代理用同源转发 | 避免 CORS，隐藏 API Key |
| MVP 优先本地草案 | 不允许 AI 超时阻断用户流程 |
| 按阶段分配 token 预算 | 不同阶段输出复杂度差异大 |
| cache key 含 systemPrompt hash | 修改 prompt 必须失效缓存 |
| 所有对象渲染前归一化 | 防止 React Error #31 |
| Fallback 明确标记 source='local-rule' | 不冒充 AI 输出 |

---

## 关键文件索引

| 文件 | 职责 |
|------|------|
| `src/api/evaluate.ts` | 核心 AI 集成 (VibeAIError, JSON管线, 校验, 缓存, 重试) |
| `api/ai-proxy.ts` | Vercel Edge Function 代理 |
| `vite.config.ts` | 本地开发代理 |
| `src/prompts/suggestStagePrompt.ts` | 通用阶段 prompt |
| `src/prompts/mvpScopePrompt.ts` | MVP 轻量 prompt |
| `src/prompts/stageContext.ts` | 按阶段压缩上下文 |
| `src/prompts/optimizeHandoffPrompt.ts` | Handoff 优化 prompt |
| `src/pages/MvpScopePage.tsx` | MVP 页面 (local-rule pre-fill + fallback) |
| `src/pages/SettingsPage.tsx` | AI 配置 + 4 层诊断 |
| `src/pages/DeveloperHandoffPage.tsx` | 开发交付 (toDisplayText 保护) |
| `src/hooks/useProductBrief.ts` | 状态管理 + Schema Migration |
| `src/lib/utils.ts` | toDisplayText / toDisplayList |
| `src/types.ts` | 类型定义 (含 validationWarnings) |

---

## 构建与部署

```bash
# 本地开发
npm install
npm run dev          # http://localhost:5173

# 构建 + Lint（提交前必跑）
npm run build        # 必须零错误
npm run lint         # 必须零 error

# Vercel 部署
git push origin main # 自动触发
```

---

> 最后更新：2026-05-26  
> 版本：Vibe Copilot V1.7 + latest fixes  
> 所有修复已推送到 `liuanye9-lab/vibe-product-framing-web` main 分支
