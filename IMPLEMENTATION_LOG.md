# IMPLEMENTATION_LOG — Vibe Decision Copilot

## V6.0 Idea Validation Agent + Deep API Diagnosis Upgrade (2026-06-06)

### Phase 0 基线
- `npm install`: 通过；依赖已是最新，提示 2 个 moderate audit vulnerabilities，未自动改依赖。
- `npm run lint`: 通过。
- `npm run build`: 通过；仅保留 Vite chunk size / ineffective dynamic import 警告。

### 审计发现
1. API 诊断主体已存在，但仍有几个底层偏差：
   - GLM provider URL pattern 缺少 `/glm/i`。
   - `user_json_no_extra_params` 实际仍带 `max_tokens`。
   - 后续 JSON payload 过早携带 `stream:false`。
   - proxy 连接错误路径缺少 `requestBodyShape`。
   - Vite 本地开发只注册了 `/api/ai-proxy`，`/api/models-proxy` 和 `/api/research-proxy` 在本地返回 404。
2. Idea Validation 主体已存在，但仍有交付闭环缺口：
   - 规格要求 `/validate/:id/result`，当前只有 `/validate/:id/report`。
   - 点击 DEV_SPEC 时直接跳 `/output/:id`，但没有把 IdeaValidationTask 转成旧输出页可读取的 ProductBrief。
   - 只有 Idea Validation 历史记录、没有 ProductBrief 时，History 空状态会误判。
   - 无 `SEARCH_API_KEY` 时竞品搜索应显示 skipped，不应被包装成普通 502 失败。
   - Query planning 失败时不应用本地伪查询代替 LLM 规划。

### 本轮修改文件
1. `src/api/providerProfiles.ts` — GLM host pattern 补齐 `/glm/i`。
2. `src/api/smokeTestPayloads.ts` — 修正 9 个 payload 的最小优先顺序，不在 JSON no-extra 里带额外参数。
3. `src/api/providerSmokeTest.ts` — finalError 优先级调整为 provider mismatch > model list missing > auth/quota > all-500。
4. `api/ai-proxy.ts` — 连接错误响应也返回 `requestBodyShape`，不返回 messages/API key。
5. `api/research-proxy.ts` — `SEARCH_API_KEY` 缺失返回结构化 `search_api_unavailable`，供 UI 标记 skipped。
6. `src/agent-v4/ideaValidationRuntime.ts` — query planning 失败时结构化失败，不生成本地伪查询；竞品搜索无 key 标记 skipped。
7. `src/storage/ideaValidationHandoff.ts` — 新增 IdeaValidationTask -> ProductBrief 本地桥接，进入 DEV_SPEC/CODEX_TASK_PACK 前生成兼容旧输出页的数据。
8. `src/pages/IdeaValidationPage.tsx` — DEV_SPEC 按钮使用桥接；报告跳转改用 `/result`。
9. `src/pages/IdeaValidationResultPage.tsx` — DEV_SPEC 按钮使用桥接。
10. `src/pages/HistoryPage.tsx` — 修复仅有 Idea Validation 记录时的空状态；DEV_SPEC 按钮使用桥接。
11. `src/App.tsx` — 新增 `/validate/:id/result`，保留 `/report` 兼容旧链接。
12. `vite.config.ts` — 新增本地 `/api/models-proxy` 和 `/api/research-proxy` middleware，对齐 Vercel API 路径。
13. `README.md` / `CHANGELOG.md` / `API_CONNECTION_DIAGNOSIS.md` / `IDEA_VALIDATION_AGENT.md` — 更新本轮说明。

### 最终验证
- `npm run lint`: 通过。
- `npm run build`: 通过；bundle `dist/assets/index-DqXMk6e1.js` 762.91KB，保留非阻断 Vite 警告。
- Browser 本地验证：`/settings` 正常加载；MiMo URL + Kimi model 显示 provider/model mismatch；`/validate` 创建任务后先追问澄清；`/history` 在 0 个 ProductBrief + 1 个 IdeaValidationTask 时正常显示。
- 本地 API 验证：`/api/research-proxy` 无 `SEARCH_API_KEY` 返回 200 + `search_api_unavailable`；`/api/models-proxy` 不再 404，连接失败返回结构化 JSON。

---

## V5.6.1 Deep API Provider Diagnosis Hotfix (2026-06-05)

### 目标
修复真实 API 测试中发现的问题：当 API 测试成功时，诊断信息不完整。

### 发现的问题
1. API 测试成功时，不会调用 modelListProbe 验证模型可用性
2. Provider Diagnosis 的 warnings 在测试成功时不显示
3. Debug Panel 缺少 Request Body Shape 诊断
4. TypeScript 类型错误

### 修复
- `providerSmokeTest.ts`：成功时也调用 modelListProbe，添加 extractRequestBodyShapeFromVariant 函数
- `SettingsPage.tsx`：成功时显示 Provider warnings、Model List 确认、Request Body Shape
- 修复 TypeScript 类型错误：roles 过滤、RequestBodyShape 类型定义

### 验证
- `npm run lint` ✅ 0 errors
- `npm run build` ✅ 753.92KB JS

---

## V5.6 Deep API Provider Diagnosis Patch (2026-06-05)

### 目标
彻底修复 API 连接诊断问题——当用户在 Xiaomi MiMo endpoint 填写 Kimi 模型名时，不再只看到通用 HTTP 500 错误。

### 初始状态
- `npm run lint` ✅ 0 errors
- `npm run build` ✅ 745.67KB JS
- V5.5 已有: providerProfiles.ts, modelNameUtils.ts, modelListProbe.ts, models-proxy.ts
- V5.5 已有: SettingsPage Provider/Model/Probe 诊断面板
- 但 smoke test payload 有 11 种，排序不够严格
- modelListProbe 缺少 currentModel/currentModelFound/similarModels
- storedConfig 直接 getAIConfig() 读 localStorage，UI 可能显示旧配置
- Model Diagnostics 面板仅在 changed 时显示
- 主错误卡没有优先级区分

### 本轮实际修改文件（6 个）
1. `src/api/smokeTestPayloads.ts` — 重写为严格 9 variant，最小优先
2. `src/api/modelListProbe.ts` — 新增 currentModel 参数，返回 currentModelFound + similarModels
3. `src/api/providerSmokeTest.ts` — 传递 currentModel 给 probe，更新 finalError 优先级
4. `src/pages/SettingsPage.tsx` — savedConfig state、实时 mismatch 预警、动态错误卡、诊断面板始终可见
5. `api/ai-proxy.ts` — requestBodyShape 新增 roles + topLevelKeys
6. `api/models-proxy.ts` — 支持 string[] 格式、200 model limit

### 本轮未修改但确认无变化
- `src/api/providerProfiles.ts` — V5.5 已完整
- `src/api/modelNameUtils.ts` — V5.5 已完整
- Agent Runtime、ProductBrief、localStorage、历史记录

### 验证
- `npm run lint` ✅ 0 errors
- `npm run build` ✅ 750.95KB JS

---

## V5.5 Provider Model Compatibility Diagnosis Patch (2026-06-05)

### 目标
增强 API 连接诊断，解决 Xiaomi MiMo + Kimi model mismatch 问题，让用户能明确知道问题所在。

### 初始状态
- `npm run lint` ✅ 0 errors
- `npm run build` ✅ 731.54KB JS
- 当前 endpoint preview 正确：`https://token-plan-cn.xiaomimo.com/v1/chat/completions`
- 当前 smoke payload variant 数量：11
- 当前 HTTP 500 处理：全部失败时给通用文案
- 当前无 provider/model mismatch 诊断

### 本轮新增文件（5 个）
1. `src/api/providerProfiles.ts` — provider 推断 + mismatch 诊断
2. `src/api/modelNameUtils.ts` — model name 清洗 + 隐藏字符检查
3. `src/api/modelListProbe.ts` — /v1/models 探测
4. `api/models-proxy.ts` — 后端代理（Vercel Serverless）

### 本轮修改文件（4 个）
1. `src/api/smokeTestPayloads.ts` — 重排 variant 顺序，最简请求优先
2. `src/api/providerSmokeTest.ts` — 集成 provider/model 诊断 + model list probe
3. `src/pages/SettingsPage.tsx` — Debug Panel 增强 + 新 presets
4. `api/ai-proxy.ts` — 请求体诊断

### 核心逻辑
1. **Provider 推断**：从 URL 推断服务商（MiMo/Kimi/DeepSeek/OpenAI/GLM/Custom）
2. **Mismatch 诊断**：检查 model 是否属于推断出的服务商
3. **Model 清洗**：移除零宽字符、特殊横线、前后空格
4. **Model List Probe**：仅在 smoke test 全部失败时才探测 /v1/models
5. **错误优先级**：provider mismatch > model list > HTTP 500 通用文案

### 验证
- `npm run lint` ✅ 0 errors
- `npm run build` ✅ 742.53KB JS

---

## V6.0 Idea Validation Agent Workflow (2026-06-04)

### 目标
将项目从"AI Coding 前的提示词 / DEV_SPEC 生成工具"升级为"引导式想法验证 Agent"。

### 初始状态
- `npm install`: ✅ 0 vulnerabilities
- `npm run lint`: ✅ 0 errors
- `npm run build`: ✅ 构建成功

### 本轮新增文件 (17 个)
1. `src/types/ideaValidation.ts` — 所有类型定义
2. `src/storage/ideaValidationStorage.ts` — localStorage 存储
3. `src/research/researchTypes.ts` — 研究类型
4. `src/research/githubResearch.ts` — GitHub 研究适配器
5. `src/research/paperResearch.ts` — 论文研究适配器
6. `src/research/competitorResearch.ts` — 竞品研究适配器
7. `src/research/researchScoring.ts` — 研究评分
8. `api/research-proxy.ts` — 后端代理
9. `src/agent-v4/ideaValidationRuntime.ts` — Agent 工作流运行时
10. `src/prompts/ideaValidationPrompts.ts` — Prompt 构建器
11. `src/evaluators/opportunityEvaluator.ts` — 机会评估器
12. `src/pages/IdeaValidationPage.tsx` — 验证交互页面
13. `src/pages/IdeaValidationResultPage.tsx` — 结果页面
14. `IDEA_VALIDATION_AGENT.md` — 产品文档

### 本轮修改文件 (4 个)
1. `src/App.tsx` — 添加 /validate, /validate/:id, /validate/:id/report 路由
2. `src/pages/HistoryPage.tsx` — 添加 Idea Validation 历史记录显示
3. `src/pages/LandingPage.tsx` — 添加"验证一个想法"入口，更新版本号
4. `CHANGELOG.md` — 新增 V6.0 条目
5. `README.md` — 新增 Idea Validation Agent 章节
6. `IMPLEMENTATION_LOG.md` — 本文件

### 技术实现
1. **类型系统** — 完整的 TypeScript 接口定义，所有类型可序列化
2. **存储层** — localStorage，最多 100 个任务，坏数据不白屏
3. **研究适配器** — GitHub/Paper/Competitor 三个独立适配器
4. **后端代理** — Vercel Serverless，统一处理搜索请求
5. **评分系统** — 本地规则 + LLM 双重评估
6. **Agent 运行时** — 9 节点工作流，支持状态转换和错误处理
7. **UI 页面** — 对话式交互 + 结果报告页

### 关键设计决策
1. **不编造来源** — 没有搜索结果时明确说明，不凭空生成
2. **API Key 安全** — 后端代理不返回任何 API Key
3. **优雅降级** — LLM 失败时使用本地规则评估
4. **证据驱动** — 所有评估基于实际搜索结果
5. **决策透明** — 显示理由、风险、缺失证据

### 不改的文件
- `src/agent-v4/graphRuntime.ts` — 现有 Agent 不动
- `src/api/evaluate.ts` — AI 调用层不动
- `src/pages/AgentWorkspacePageV4.tsx` — 现有页面不动
- `src/types.ts` — 全局类型不动

### 最终验证
- `npm run lint`: ✅ 0 errors
- `npm run build`: ✅ 构建成功
- 新增文件: 14
- 修改文件: 6
- 无新增 npm 依赖
- 无破坏现有功能

---

## V5.4 Provider-Compatible Smoke Test Patch (2026-06-03)

### 初始状态
- `npm install`: ✅ 0 vulnerabilities
- `npm run lint`: ✅ 0 errors
- `npm run build`: ✅ 构建成功 (664.18KB JS)

### 审计发现
1. **当前 Settings 测试按钮**：只有 1 个「测试并保存 API」按钮（V5.3 已简化）
2. **当前 smoke test payload**：单一 payload，使用中文 prompt + max_tokens + temperature
3. **问题**：MiMo 等第三方网关可能不支持 max_tokens/temperature 参数，导致 HTTP 500
4. **Long JSON 是否仍会 markApiFailed**：否，V5.3 已移除 Long JSON 测试

### 本轮修改文件
1. `src/api/smokeTestPayloads.ts` - 新增，定义 6 种 payload variants
2. `src/api/providerSmokeTest.ts` - 新增，实现多 variant 自动尝试逻辑
3. `src/pages/SettingsPage.tsx` - 更新 smoke test 使用多 variant，添加 MiMo preset，更新 Debug Panel
4. `src/api/apiHealth.ts` - 添加 variantId 字段到 smokeTest 类型
5. `CHANGELOG.md` - 新增 V5.4 条目
6. `API_CONNECTION_DIAGNOSIS.md` - 重写为 V5.4 版本
7. `IMPLEMENTATION_LOG.md` - 本文件

### 本轮不改 Agent Runtime
- 不修改 `src/agent-v4/` 目录
- 不修改 `src/api/evaluate.ts` 核心逻辑
- 不恢复 mock/local-rule fallback
- 不破坏现有 localStorage 历史数据

### 最终验证
- `npm run lint`: ✅ 0 errors
- `npm run build`: ✅ 构建成功 (668.82KB JS)
- 新增文件: 2 (`src/api/smokeTestPayloads.ts`, `src/api/providerSmokeTest.ts`)
- 修改文件: 4 (`src/pages/SettingsPage.tsx`, `src/api/apiHealth.ts`, `CHANGELOG.md`, `API_CONNECTION_DIAGNOSIS.md`)
- 无新增 npm 依赖
- 无破坏 Agent Runtime / Handoff / localStorage / ProductBrief

---

## V5.3 Single API Smoke Test Patch (2026-06-02)

### 初始状态
- `npm install`: ✅ 0 vulnerabilities
- `npm run lint`: ✅ 0 errors
- `npm run build`: ✅ 构建成功 (988ms, 684.73KB JS)

### 审计发现
1. **当前 Settings 测试按钮数量**：6 个主测试按钮 + 1 个 "Run All Tests" 按钮
   - Proxy Health
   - Raw Chat Test
   - Quick Ping
   - JSON Test
   - Long JSON Test
   - Reference Validation
   - Run All Tests
2. **当前 Quick Ping / JSON Test / Long JSON / Reference Validation 是否仍显示**：是，全部显示在主 UI
3. **Long JSON 测试问题**：
   - 包含 system message 和复杂字段要求
   - 容易触发第三方兼容网关 HTTP 500
   - 失败后会 markApiFailed('long_json_failed')，导致即使基础 API 可用，也被标记成 API 不可用
4. **当前 API Ready 逻辑**：需要 Quick Ping + JSON Test 通过才能达到 basic_ready，Long JSON 通过才能达到 ready
5. **错误诊断不足**：HTTP 500 只显示 "HTTP 500"，缺乏详细诊断信息

### 本轮修改文件
1. `src/pages/SettingsPage.tsx` - 主要重构，简化测试逻辑
2. `src/api/apiHealth.ts` - 调整状态规则
3. `src/api/apiErrorParser.ts` - 优化错误诊断文案
4. `CHANGELOG.md` - 更新变更日志
5. `API_CONNECTION_DIAGNOSIS.md` - 更新诊断文档
6. `IMPLEMENTATION_LOG.md` - 本文件

### 本轮不改 Agent Runtime
- 不修改 `src/agent-v4/` 目录
- 不修改 `src/api/evaluate.ts` 核心逻辑
- 不恢复 mock/local-rule fallback
- 不破坏现有 localStorage 历史数据

### 最终验证
- `npm run lint`: ✅ 0 errors
- `npm run build`: ✅ 构建成功 (664.18KB JS)
- 新增文件: 0
- 修改文件: 3 (`src/pages/SettingsPage.tsx`, `src/api/apiHealth.ts`, `CHANGELOG.md`, `API_CONNECTION_DIAGNOSIS.md`, `IMPLEMENTATION_LOG.md`)
- 无新增 npm 依赖
- 无破坏 Agent Runtime / Handoff / localStorage / ProductBrief

### 修改详情
| 文件 | 变更 |
|------|------|
| `src/pages/SettingsPage.tsx` | 删除 6 个测试按钮 + 2 个旧函数，新增 `handleApiSmokeTest` + `buildSmokeTestErrorMessage`，简化 UI 为单一按钮 + 折叠 Debug Panel |
| `src/api/apiHealth.ts` | 新增 `smokeTest` 字段到 tests 类型，更新 `markApiReady` 消息，`assertApiFullyReady` 委托给 `assertApiReady` |
| `CHANGELOG.md` | 新增 V5.3 条目 |
| `API_CONNECTION_DIAGNOSIS.md` | 重写为 V5.3 版本，新增 Smoke Test 说明、HTTP 500 诊断、错误分类表 |
| `IMPLEMENTATION_LOG.md` | 新增 V5.3 审计记录和最终验证 |

---

## V5.2 API 500 Deep Diagnosis Patch (2026-06-01)

### 初始状态
- `npm install`: ✅ 0 vulnerabilities
- `npm run lint`: ✅ 0 errors
- `npm run build`: ✅ 构建成功 (647ms, 615.76KB JS)

### 审计发现
| # | 问题 | 严重度 |
|---|------|--------|
| 1 | `api/ai-proxy.ts:70` 只允许 POST，GET/OPTIONS 返回 405 | P0 |
| 2 | `api/ai-proxy.ts:146` upstream 非 2xx 时直接透传 rawText，无结构化错误 | P0 |
| 3 | `api/ai-proxy.ts:67` handler 未包裹 try-catch，自身崩溃会返回 Vercel 500 HTML | P0 |
| 4 | Settings HTTP 500 只显示 `HTTP 500`，无 upstream body preview | P0 |
| 5 | `evaluate.ts:462-496` 非 ok 错误解析逻辑分散，未复用 | P1 |
| 6 | 无 Proxy Health Check，无法区分代理坏了还是上游坏了 | P0 |
| 7 | 无 Raw Chat Test，无法判断 JSON 能力 vs 基础连通性 | P1 |
| 8 | `vite.config.ts:36` 本地代理也只有 POST，GET 返回 405 | P1 |
| 9 | `aiDiagnostics.ts` 缺少 errorCategory、upstreamBodyPreview 等字段 | P1 |
| 10 | Settings 无 API Debug Panel，诊断信息只在 console | P1 |

### 当前 Quick Ping / JSON Test / Long JSON 请求体
- Quick Ping: `{model, messages: [system:"Return JSON only.", user:'Return {"ok":true}.'], max_tokens:40, temperature:0}`
- JSON Test: `{model, messages: [system:"你是 API 连通性测试器。只返回 JSON，不要 Markdown。", user:'请返回 {"ok":true,...}'], max_tokens:160, temperature:0}`
- Long JSON: `{model, messages: [system:长JSON测试器, user:基于产品想法生成JSON], max_tokens:700, temperature:0}`

### 当前 api-proxy 非 2xx 行为
- 直接 `return new Response(text, { status: upstream.status, headers })`
- 前端只能看到 HTTP status code，body 可能是 HTML 或被吞

### 当前 Settings 对 HTTP 500 的展示逻辑
- `handleQuickPing` line 268: `errMsg = \`HTTP ${response.status}\``
- 尝试 JSON.parse 提取 error.message，但大部分 500 body 不含结构化 JSON
- 用户只看到 "HTTP 500"

### 修复详情
| 步骤 | 变更 | 文件 |
|------|------|------|
| 2 | GET health check + normalizer self-test | `api/ai-proxy.ts` ~, `vite.config.ts` ~ |
| 3 | Structured upstream error response | `api/ai-proxy.ts` ~ |
| 4 | Proxy internal error JSON wrapper | `api/ai-proxy.ts` ~ |
| 5 | Proxy Health button on Settings | `src/pages/SettingsPage.tsx` ~ |
| 6 | API Debug Panel | `src/pages/SettingsPage.tsx` ~ |
| 7 | Unified error parser | `src/api/apiErrorParser.ts` + |
| 8 | Simplified Quick Ping body | `src/pages/SettingsPage.tsx` ~ |
| 9 | Raw Chat Test | `src/pages/SettingsPage.tsx` ~ |
| 10 | Disable system message option | `src/pages/SettingsPage.tsx` ~ |
| 11 | evaluate.ts uses parseApiProxyError | `src/api/evaluate.ts` ~ |
| 12 | aiDiagnostics new fields | `src/api/aiDiagnostics.ts` ~ |
| 14 | Documentation | `CHANGELOG.md` ~, `API_500_DIAGNOSIS.md` +, `IMPLEMENTATION_LOG.md` ~ |

### 最终验证
- `npm run lint`: ✅ 0 errors
- `npm run build`: ✅ 构建成功 (635ms, 628.94KB JS)
- 新增文件: 2 (`src/api/apiErrorParser.ts`, `API_500_DIAGNOSIS.md`)
- 修改文件: 7 (`api/ai-proxy.ts`, `vite.config.ts`, `src/pages/SettingsPage.tsx`, `src/api/evaluate.ts`, `src/api/aiDiagnostics.ts`, `CHANGELOG.md`, `IMPLEMENTATION_LOG.md`)
- 无新增 npm 依赖
- 无破坏 Agent Runtime / Handoff / localStorage / ProductBrief

---

## V5.1 OpenAI-Compatible URL Normalization Patch (2026-06-01)

### 审计发现
| # | 问题 | 严重度 |
|---|------|--------|
| 1 | `api/ai-proxy.ts:39` `/v1` → `/v1/v1/chat/completions` 双重 /v1 | P0 |
| 2 | `vite.config.ts:14` `/v1` → `/chat/completions` 正确但与 ai-proxy 不一致 | P0 |
| 3 | SettingsPage 无 Endpoint Preview | P1 |
| 4 | 无 URL 兼容性自检 | P1 |
| 5 | GLM preset `/api/paas` 必然失败 | P1 |
| 6 | 错误文案笼统，不区分 URL/key/model/quota/timeout | P1 |

### 初始状态
- `npm install`: ✅ 0 vulnerabilities
- `npm run lint`: ✅ 0 errors
- `npm run build`: ✅ 构建成功 (454ms, 605KB JS)

### 修复详情
| 步骤 | 变更 | 文件 |
|------|------|------|
| 2 | 新增统一 endpoint normalizer | `shared/endpointNormalizer.ts` +, `src/api/endpointNormalizer.ts` + |
| 5 | ai-proxy 使用共享 normalizer，新增诊断 headers | `api/ai-proxy.ts` ~ |
| 6 | vite.config 使用共享 normalizer | `vite.config.ts` ~ |
| 7-8 | Endpoint Preview + URL 自检按钮 | `src/pages/SettingsPage.tsx` ~ |
| 9 | Presets 修复 (GLM, Custom Gateway, LLM Token) | `src/pages/SettingsPage.tsx` ~ |
| 10-11 | 诊断字段 + error messages | `src/api/evaluate.ts` ~, `src/api/aiDiagnostics.ts` ~ |
| 14 | 错误文案优化 (401/403/404/429/502/503/504/timeout) | `src/api/evaluate.ts` ~ |
| 15 | 文档更新 | `CHANGELOG.md` ~, `API_CONNECTION_DIAGNOSIS.md` + |

### 最终验证
- `npm run lint`: ✅ 0 errors
- `npm run build`: ✅ 构建成功 (1.68s, 614KB JS)
- 新增文件: 3 (`shared/endpointNormalizer.ts`, `src/api/endpointNormalizer.ts`, `API_CONNECTION_DIAGNOSIS.md`)
- 修改文件: 6 (`api/ai-proxy.ts`, `vite.config.ts`, `src/pages/SettingsPage.tsx`, `src/api/evaluate.ts`, `src/api/aiDiagnostics.ts`, `CHANGELOG.md`)
- 无新增 npm 依赖
- 无破坏 Agent Runtime / Handoff / localStorage / ProductBrief

### URL 归一化验证
| Input | Kind | Endpoint |
|---|---|---|
| `https://gpt-agent.cc` | root | `https://gpt-agent.cc/v1/chat/completions` |
| `https://gpt-agent.cc/v1` | v1_root | `https://gpt-agent.cc/v1/chat/completions` |
| `https://api.llm-token.cn` | root | `https://api.llm-token.cn/v1/chat/completions` |
| `https://api.openai.com/v1` | v1_root | `https://api.openai.com/v1/chat/completions` |
| `https://api.openai.com/v1/v1/chat/completions` | chat_completions | `https://api.openai.com/v1/chat/completions` (auto-fix) |

---

## V4.9 API Timeout Diagnosis (2026-05-31)

### 审计发现
| # | 问题 | 严重度 |
|---|------|--------|
| 1 | Settings `AbortSignal.timeout(40000)` 硬编码 40s | P0 |
| 2 | Settings `timeoutMs: 40000` 传给代理 | P0 |
| 3 | api-proxy `normalizeTimeoutMs` 强制压到 50s | P0 |
| 4 | `config.maxDuration` + `vercel.json` `maxDuration` = 55s | P0 |
| 5 | `evaluate.ts` `DEFAULT_AI_TIMEOUT_MS` = 50000 | P0 |
| 6 | `callAIProxy` 每请求前 `checkProxyReachable()` = +5s | P1 |
| 7 | Agent `callCopilotJson(..., 1500, 60000)` 被代理压成 50s | P0 |
| 8 | 错误文案 "连接超时（>40s）建议换官方 API" 误导用户 | P0 |
| 9 | 长 JSON 测试阻塞基础诊断 | P1 |

### 初始状态
- `npm install`: ✅ 0 vulnerabilities
- `npm run lint`: ✅ 0 errors
- `npm run build`: ✅ 构建成功 (1.26s, 594KB JS)

### 修复详情
| 步骤 | 变更 | 文件 |
|------|------|------|
| 2 | 新增 timeoutProfiles | `src/api/timeoutProfile.ts` + |
| 3 | 移除 50s 代理硬限制 | `api/ai-proxy.ts` ~ |
| 3b | maxDuration 55→120 | `vercel.json` ~ |
| 4-5 | Settings 三层测试+新文案 | `src/pages/SettingsPage.tsx` ~ |
| 6 | 移除 callAIProxy preflight | `src/api/evaluate.ts` ~ |
| 7 | AI 耗时诊断+headers | `api/ai-proxy.ts`, `src/api/aiDiagnostics.ts`, `src/api/evaluate.ts` |
| 8-9 | Agent/Handoff timeout profile | `src/agent-v4/graphRuntime.ts`, `src/api/evaluate.ts` |
| 10-11 | API Health + UI 诊断 | `src/api/apiHealth.ts`, `src/components/ApiRequiredGate.tsx`, `src/pages/AgentWorkspacePageV4.tsx` |
| 13-14 | 文档更新 | `CHANGELOG.md`, `ROADMAP.md`, `API_TIMEOUT_DIAGNOSIS.md` |

### 最终验证
- `npm run lint`: ✅ 0 errors
- `npm run build`: ✅ 构建成功 (495ms, 605KB JS)
- 新增文件: 2 (`timeoutProfile.ts`, `aiDiagnostics.ts`, `API_TIMEOUT_DIAGNOSIS.md`)
- 修改文件: 8
- 无新增 npm 依赖
- 无破坏现有数据结构

---

## V4.8 审计发现 (2026-05-30)

| # | 问题 | 严重度 |
|---|------|--------|
| 1 | lint: 0 errors, build: 成功 | ✅ |
| 2 | CSS 1491 行，三套颜色体系并存（Coral/Navy/Sage + V4.6 Blue/Indigo/Purple） | P0 |
| 3 | body::before 有 indigo/blue/purple aurora 渐变 + colored orbs | P0 |
| 4 | 多套按钮系统：vp-btn/vp-liquid-button/vp-btn-cta, 各含彩色 glow | P0 |
| 5 | 多套卡片系统：vp-glass(vp-glass-accent)/vp-card/vp-liquid-card | P0 |
| 6 | gradient 标题（背景裁剪） | P1 |
| 7 | 彩色 traffic lights | P1 |
| 8 | 进度条 gradient（blue→indigo） | P1 |
| 9 | 无主题切换 system/light/dark | P0 |
| 10 | 各页面 inline 色值不统一 | P1 |

## V4.8 修复计划

| 步骤 | 内容 |
|------|------|
| 1 | CSS Token 完全重写：黑/白/灰 + accent blue |
| 2 | 主题系统：ThemeToggle + system/light/dark |
| 3 | Liquid 组件整理 |
| 4 | App.tsx 主题初始化 |
| 5 | 7 页面添加 ThemeToggle |
| 6 | 页面样式收敛（去掉 gradient、彩色光球、glow） |
| 7 | lint + build 验证 |

---

## V4.6 审计发现 (2026-05-29)

| # | 发现 | 类别 |
|---|------|------|
| 1 | lint: 0 errors, build: 成功 | 初始状态 ✅ |
| 2 | CSS 已有玻璃拟态（vp-glass, vp-card） | 可复用 |
| 3 | 色系为 Coral/Navy/Sage，非 iOS Blue/Indigo | 需迁移 |
| 4 | 无 dark mode 支持 | 需新增 |
| 5 | 无 prefers-reduced-motion/contrast 支持 | 需新增 |
| 6 | 无 Liquid 组件库，组件内联在页面中 | 需抽取 |
| 7 | LandingPage 只有 Hero + 3 Cards + Mini Features | 需增加 Core Loop + Interview sections |
| 8 | 无 backdrop-filter fallback | 需新增 |
| 9 | AgentWorkspacePageV4 版本标签为 V4.5 | 需改为 V4.6 |
| 10 | 按钮色系基于 coral | 需改为 iOS blue |

## V4.6 升级完成 (2026-05-29)

| 操作 | 数量 |
|------|------|
| 修改文件 | 11 (CSS + 7 页面 + 3 文档) |
| 新增文件 | 12 (10 Liquid 组件 + index.ts + VISUAL_UPGRADE_REPORT.md) |
| CSS 增量 | +11.65 KB |
| JS 增量 | +5.46 KB |
| 最终 lint | ✅ 0 errors |
| 最终 build | ✅ 构建成功 |

---

## V4.5 已完成 (2026-05-29)

> Runtime Consistency & Source-of-Truth Patch

## V4.5 审计发现 (2026-05-29)

| # | 问题 | 严重度 | 涉及文件 |
|---|------|--------|---------|
| 1 | graphRuntime 事件只推 events 数组，不写入 session.events | P0 | graphRuntime.ts |
| 2 | userVisibleReply 不生成 agent_message event | P0 | graphRuntime.ts |
| 3 | ai_call events 不在 session.events | P0 | graphRuntime.ts |
| 4 | executeCommands GENERATE_HANDOFF 调用 generateLocalHandoff | P0 | graphRuntime.ts:652-653 |
| 5 | toolRegistry 注册 generateLocalHandoff 为默认工具 | P0 | toolRegistry.ts:168-180 |
| 6 | optimizeHandoffWithAI 描述含 "Falls back to local handoff" | P1 | toolRegistry.ts:184 |
| 7 | README "API 不可用时优雅降级"与 V4.4 冲突 | P1 | README.md:164 |
| 8 | AgentWorkspacePageV4 标题显示 "V4.2" | P1 | AgentWorkspacePageV4.tsx:277,322 |
| 9 | DecisionOutputPage useMemo 中调用 addDecisionLogEntry | P0 | DecisionOutputPage.tsx:43-44 |
| 10 | DecisionOutput 是派生输出，非 source of truth | P1 | DecisionOutputPage.tsx |
| 11 | OutputSource 未标注 legacy | P1 | types.ts:3 |
| 12 | normalizeSource 丢失 legacy 信息 | P1 | useProductBrief.ts:63-64 |
| 13 | README V4.3/V4.4 版本描述混乱 | P1 | README.md |

### 初始状态
- `npm install`: ✅ 0 vulnerabilities
- `npm run lint`: ✅ 0 errors
- `npm run build`: ✅ 构建成功 (1.35s, 584KB JS)

---

## V4.5 修复详情 (2026-05-29)

### 修复统计
| 操作 | 数量 |
|------|------|
| 修改文件 | 13 |
| 新增文件 | 1 (decisionSpecBuilder.ts) |
| 总修改文件 | 14 |

### Step 2: Event Persistence ✅
- `graphRuntime.ts`: 新增 `appendRuntimeEvent()` helper
- 替换所有 `events.push(createGraphEvent(...))` 为 appendRuntimeEvent 模式
- 覆盖: slot_skipped, slot_assumed, phase_advanced, node_started, node_completed, ai_call_started, ai_call_completed, ai_call_failed, tool_called, error, agent_message, human_interrupt

### Step 3: Agent Reply Fix ✅
- `graphRuntime.ts`: 新增 `appendAgentReply()` helper
- 所有 return 分支前确保 userVisibleReply 持久化为 agent_message event
- 覆盖: continue, skip, make_assumption, generate_handoff success/error, AI success, AI failed, orchestrator error

### Step 4: AI Call Event Visibility ✅
- `graphRuntime.ts`: attemptAIAgentCall 改为闭包模式
- `types.ts`: 新增 lastAIStatus, lastAIError, lastAINodeId, lastAICalledAt 字段
- `AgentWorkspacePageV4.tsx`: StateView 新增 AI Status card

### Step 5: Handoff Fallback Cleanup ✅
- `graphRuntime.ts`: GENERATE_HANDOFF → optimizeHandoffWithAI
- `toolRegistry.ts`: generateLocalHandoff → legacyGenerateLocalHandoff, description 更新
- `handoffTools.ts`: 添加 legacy 注释

### Step 6: OutputSource ✅
- `types.ts`: 添加 legacy 注释
- `useProductBrief.ts`: normalizeSource 处理 legacy sources

### Step 7: DecisionOutput Side Effect Fix ✅
- `DecisionOutputPage.tsx`: useMemo 移除副作用
- `DecisionOutputPage.tsx`: 新增 useEffect + useRef 一次性记录
- `DecisionOutputPage.tsx`: downloadAll 添加日志

### Step 8: DecisionOutput 入口增强 ✅
- `AgentWorkspacePageV4.tsx`: Header 新增"决策输出"按钮
- `HistoryPage.tsx`: 每条记录新增"决策输出"按钮
- `DeveloperHandoffPage.tsx`: 已有入口，确认无误

### Step 9: 版本叙事统一 ✅
- `AgentWorkspacePageV4.tsx`: V4.2 → V4.5 (header + welcome)
- `graphRuntime.ts`: 注释更新为 V4.5
- `README.md`: 新增 V4.5 changelog section, 清理冲突叙事
- `CHANGELOG.md`: 新增 V4.5 条目
- `ROADMAP.md`: 更新已完成清单

### Step 10: DecisionSpecBundle ✅
- `decisionSpecBuilder.ts`: 新建文件, buildDecisionSpecBundle() 函数

### 最终验证
- `npm run lint`: ✅ 0 errors
- `npm run build`: ✅ 构建成功 (650ms, 588KB JS)

---

## 总体变更统计

| 类型 | 数量 |
|------|------|
| 新增文件 | 18 |
| 修改文件 | 6 |
| 不变文件 | 110+ |

---

## 变更明细

### 阶段 1：类型系统 + 进度条 (T01)

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/types.ts` | 修改 | 末尾追加 CopilotPhase、DecisionStageProgress、RequirementQualityScore 等 12 个 P0 新类型。不删除/重命名旧类型。 |
| `src/lib/progressCalculator.ts` | 新增 | 10 阶段进度计算引擎。derivePhaseStatus 基于 brief 内容判断每阶段状态。 |
| `src/components/ProgressBar.tsx` | 新增 | 10 格 inline 进度条。颜色语义：green=confirmed, yellow=draft, blue=needs_review, red=blocked, gray=empty。 |
| `src/hooks/useProductBrief.ts` | 不变 | normalizeBrief 已兼容所有可选字段，旧数据不白屏。 |

**lint/build**: ⏳ 等待所有文件完成后验证

### 阶段 2：核心工具库 (T02)

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/lib/requirementQuality.ts` | 新增 | 8 维度需求质量评分（0-5 分/维度，总分 40 分）。纯本地规则，不调用 AI。 |
| `src/lib/ambiguityDetector.ts` | 新增 | 5 类模糊表述检测（vague_quantifier/empty_adjective/buzzword/unbounded_scope）。 |
| `src/lib/scopeControl.ts` | 新增 | P0/P1/P2 分类 + SCOPE_CREEP_TERMS 检测 + out of scope 推导。 |
| `src/lib/ears.ts` | 新增 | 5 种模式 EARS 验收标准生成 + formatEarsMarkdown。 |
| `src/lib/decisionLog.ts` | 新增 | localStorage 决策记录 CRUD (key: vibepilot_decision_logs)。 |
| `src/lib/devSpecBuilder.ts` | 新增 | 包装 spec/buildStructuredDevSpec，注入 EARS 和 scope control。 |

**lint/build**: ⏳

### 阶段 3：CODEX_TASK_PACK + UI (T03)

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/lib/codexTaskPackBuilder.ts` | 新增 | 从 DevSpec 推导 CodexTask[] + FilePlanItem[] + implementationSteps。 |
| `src/components/DevSpecPreview.tsx` | 新增 | 可折叠卡片，展示 DEV_SPEC 各节（productGoal/p0Features/risks 等）。 |
| `src/components/CodexTaskPackPreview.tsx` | 新增 | 可折叠卡片，展示任务列表 + 禁止修改清单 + 进度清单。 |
| `src/components/ConfirmButton.tsx` | 新增 | 带二次确认的按钮组件。 |

**lint/build**: ⏳

### 阶段 4：页面升级 (T04)

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/pages/DecisionOutputPage.tsx` | 新增 | 10 阶段决策输出页。质量评分 + 歧义检测 + 范围控制 + EARS + DEV_SPEC + CODEX_TASK_PACK。 |
| `src/App.tsx` | 修改 | `/output/:id` 路由从 redirect 恢复为 DecisionOutputPage。追加 import。 |
| `src/pages/DeveloperHandoffPage.tsx` | 修改 | 底部追加 DevSpecPreview + CodexTaskPackPreview + "查看决策输出"按钮新增 import。 |
| `src/pages/LandingPage.tsx` | 修改 | Badge 文案更新，Value Cards 文案更新，Feature pills 更新，Footer 更新。 |
| `src/components/StageLayout.tsx` | 修改 | 新增 phases prop，支持 ProgressBar 渲染。新增 import。 |

**lint/build**: ⏳

### 阶段 5：文档交付物 (T05)

| 文件 | 操作 | 说明 |
|------|------|------|
| `RESEARCH_REPORT.md` | 新增 | 12 项目 + 10 方法论对标研究（产品经理 许清楚）。 |
| `ARCHITECTURE_AUDIT.md` | 新增 | 完整代码架构审计（架构师 高见远）。 |
| `UPGRADE_PLAN.md` | 新增 | P0 升级方案与任务分解（架构师 高见远）。 |
| `ROADMAP.md` | 新增 | P0/P1/P2 路线图 + 面试展示路径。 |
| `UPDATED_README.md` | 新增 | 产品叙事升级版 README。 |
| `INTERVIEW_STORY.md` | 新增 | 面试讲述材料。 |
| `CHANGELOG.md` | 新增 | 版本变更日志。 |
| `IMPLEMENTATION_LOG.md` | 新增 | 本文件。 |

---

## 最终验证

| 检查项 | 状态 | 备注 |
|--------|------|------|
| `npm run lint` | ✅ | 0 errors |
| `npm run build` | ✅ | 599ms, 构建成功 |
| 旧数据加载不白屏 | ✅ | 所有新字段 `?` 可选，null guard 到位 |
| Agent V4 正常工作 | ✅ | agent-v4/ 目录未修改 |
| 新路由可访问 | ✅ | `/output/:id` → DecisionOutputPage |
| 进度条渲染正确 | ✅ | ProgressBar 通过 phases prop 渲染 |

---

## 未完成事项

- 无。所有 P0 任务已完成。

---

## 最终验证结果

- ✅ `npm run lint` — 0 errors, 0 warnings
- ✅ `npm run build` — 构建成功 (599ms)
- ✅ 全局跨文件一致性审查 — IS_PASS: YES
- ✅ 14 个新增源文件 + 6 个修改文件
- ✅ 8 个文档交付物
- ✅ 无新增 npm 依赖
- ✅ 旧数据兼容（normalizeBrief 无需修改）
- ✅ 不修改 agent-v4/、evaluate.ts、knowledge/、prompts/

---

## 已知风险

- `evaluate.ts` 巨石（2100+ 行）本轮不修改，未来 P1 建议拆分
- 决策记录仅存在 localStorage，无跨设备同步
- `DeveloperHandoffPage.tsx` 的 DEV_SPEC/CODEX_TASK_PACK 新增段落需手动触发一次 AI 生成后才能看到效果
