# CHANGELOG — Vibe Decision Copilot

## V6.0 — Idea Validation Agent + Deep API Diagnosis Upgrade (2026-06-06)

### Added
- `src/storage/ideaValidationHandoff.ts` bridges completed Idea Validation reports into the existing ProductBrief-compatible DEV_SPEC / CODEX_TASK_PACK output path.
- `/validate/:id/result` route added while keeping `/validate/:id/report` as a compatibility alias.
- Research proxy now returns structured `search_api_unavailable` when company/web search has no `SEARCH_API_KEY`.
- Vite dev server now serves local `/api/models-proxy` and `/api/research-proxy` middleware, matching the Vercel API paths used by the browser app.

### Changed
- Smoke payload variants now follow strict minimal-first ordering with no extra params in `user_json_no_extra_params`.
- Provider smoke test final error priority is now provider mismatch > model list missing > auth/quota > all-500.
- Idea Validation query planning no longer creates local pseudo queries when the LLM query planner fails.
- Company/competitor research without a search key is marked as skipped instead of fabricated or treated as a generic hard failure.
- History works when only Idea Validation tasks exist and no ProductBrief records exist.

### Fixed
- GLM provider inference now also matches `glm` hosts.
- `api/ai-proxy.ts` connection-error diagnostics include request body shape without leaking messages or API keys.
- DEV_SPEC buttons from validation pages no longer navigate to an empty output page.
- Local dev no longer returns 404 for model-list probing or research proxy calls.

### Not Done
- No database.
- No vector RAG.
- No real MCP server.
- No fake GitHub, paper, company, or competitor generation.
- No ProductBrief schema changes.

---

## V5.6.1 — Deep API Provider Diagnosis Hotfix (2026-06-05)

### Fixed
- **Success also calls modelListProbe** — When smoke test passes, model list is still probed to verify model availability
- **Provider warnings show on success** — Provider Diagnosis warnings now display even when test passes
- **Model list confirmation on success** — Shows "✅ 模型已在服务商模型列表中确认" when model found in list
- **Request Body Shape in Debug Panel** — Shows model, messages, roles, system role, temperature, max_tokens, stream, top keys

### Changed
- **Debug Panel shows all diagnostics on success** — Provider Diagnosis, Model Diagnostics, Model List Probe, and Request Body Shape all visible regardless of test outcome

---

## V5.6 — Deep API Provider Diagnosis Patch (2026-06-05)

### Added
- **Provider profile inference** — `inferProviderFromApiUrl()` infers provider from URL patterns (MiMo/Kimi/DeepSeek/OpenAI/GLM/Custom)
- **Provider/model mismatch diagnosis** — `diagnoseProviderModelMismatch()` detects when URL and model name belong to different providers
- **Model name normalization** — `normalizeModelName()` removes zero-width chars, replaces Unicode dashes, trims
- **Model name diagnostics** — `diagnoseModelName()` reports hidden characters and special dashes
- **Model list probe** — `probeProviderModels()` checks /v1/models endpoint with `currentModelFound` and `similarModels`
- **Backend models proxy** — `api/models-proxy.ts` (Vercel Serverless) supports OpenAI, models array, and string array formats
- **Settings provider diagnosis panel** — Shows inferred provider, confidence, errors, warnings, suggestions
- **Settings model diagnostics panel** — Always visible (not just on change), shows original/normalized/warnings
- **Settings model list probe panel** — Shows probe result, model count, current model found status, similar models
- **Settings live mismatch warning** — Real-time provider/model mismatch warning above config form
- **Settings live model name warning** — Real-time hidden character/special dash warning above config form
- **Request body shape diagnostics** — `extractRequestBodyShape()` now includes `roles` and `topLevelKeys`
- **Dynamic main error card** — Priority-based: provider mismatch > model not found > auth > quota > all-500 > generic

### Changed
- **Smoke test payload ordering** — Exactly 9 variants, strictly minimal-first (was 11 with less strict ordering)
- **Smoke test saves normalized model** — After test, saves `result.normalizedModel` instead of raw input
- **savedConfig as state** — `storedConfig = getAIConfig()` replaced with `useState(() => getAIConfig())` to prevent stale UI
- **Model diagnostics panel always visible** — Shows ✓ when clean, ⚠ when changed (was hidden when unchanged)
- **HTTP 500 error copy** — Now prioritizes provider/model mismatch and model list probe results over generic "all variants failed"
- **MiMo preset warning** — Explicitly warns against using Kimi/Moonshot model names
- **FAQ updated** — HTTP 500 explanation now mentions provider mismatch and Debug panel diagnostics
- **models-proxy.ts** — Supports `string[]` direct array format, limits to 200 models
- **ai-proxy.ts** — `requestBodyShape` now includes `roles` and `topLevelKeys` fields

### Fixed
- Users could enter Xiaomi endpoint with Kimi model and only see generic HTTP 500
- Debug panel lacked model availability checking
- Model names with hidden characters were not diagnosed before test
- UI could display stale saved config after testing
- Model diagnostics panel was hidden when no changes detected
- Main error card showed generic message even when provider mismatch was detected

### Not Changed
- Agent Runtime
- ProductBrief schema
- API Required policy
- localStorage project history
- No mock/local-rule fallback

---

## V6.0 — Idea Validation Agent Workflow (2026-06-04)

### Added
- **Idea Validation Task Model** — `src/types/ideaValidation.ts` with full type definitions for validation workflow
- **Idea Validation Storage** — `src/storage/ideaValidationStorage.ts` with localStorage persistence (max 100 tasks)
- **Research Query Planner** — LLM-powered query generation for GitHub/Paper/Company searches
- **GitHub Research Agent** — `src/research/githubResearch.ts` with scoring and deduplication
- **Paper Research Agent** — `src/research/paperResearch.ts` with Semantic Scholar and arXiv support
- **Competitor Research Agent** — `src/research/competitorResearch.ts` with Tavily/Brave/SerpAPI support
- **Research Scoring** — `src/research/researchScoring.ts` with relevance scoring algorithms
- **Research Proxy API** — `api/research-proxy.ts` (Vercel Serverless) for GitHub/Paper/Web search
- **Idea Validation Runtime** — `src/agent-v4/ideaValidationRuntime.ts` with 9-node workflow
- **Idea Validation Prompts** — `src/prompts/ideaValidationPrompts.ts` with 7 prompt builders
- **Opportunity Evaluator** — `src/evaluators/opportunityEvaluator.ts` with 8-dimension scoring
- **IdeaValidationPage** — `src/pages/IdeaValidationPage.tsx` with conversational interface
- **IdeaValidationResultPage** — `src/pages/IdeaValidationResultPage.tsx` with full report view
- **New Routes** — `/validate`, `/validate/:id`, `/validate/:id/report`
- **HistoryPage Integration** — Idea Validation tasks now shown in history list
- **LandingPage Entry** — "验证一个想法" button on home page
- **IDEA_VALIDATION_AGENT.md** — Full product documentation
- **TypeScript Interfaces** — IdeaValidationTask, IdeaValidationNode, ResearchBundle, GitHubReference, PaperReference, CompetitorReference, OpportunityEvaluation, FinalValidationDecision

### Changed
- **Product Flow** — Now starts with opportunity validation before DEV_SPEC generation
- **Agent Capabilities** — Can search evidence before recommending build/no-build
- **HistoryPage** — Now shows both ProductBrief and Idea Validation tasks
- **LandingPage** — Added "验证一个想法" as secondary CTA
- **Version** — Updated to V6.0

### Not Done
- No database (localStorage only)
- No vector RAG
- No guaranteed web search if SEARCH_API_KEY missing
- No fake company/paper generation
- No automatic commercial guarantee
- No deep competitor analysis (only search + basic scoring)
- No user interview simulation
- No financial model generation
- No market size estimation

### Technical Details
- **Research Proxy** — Supports GitHub (optional GITHUB_TOKEN), Semantic Scholar/arXiv (no key required), Tavily/Brave (optional SEARCH_API_KEY)
- **Error Handling** — Never fabricates results; returns clear error states when APIs unavailable
- **Scoring** — GitHub (stars, recency, keyword), Paper (year, keyword), Competitor (keyword, URL credibility)
- **Evaluation** — 8 dimensions with weighted average; local rule-based fallback when LLM fails
- **Decision Rules** — Score >= 70 + few missing evidence → do; Score >= 50 → validate_first; Score < 40 → do_not_do

---

## V5.5 — Provider Model Compatibility Diagnosis Patch (2026-06-05)

### Added
- **Provider profile inference** (`src/api/providerProfiles.ts`): infers provider from URL (Xiaomi MiMo, Moonshot/Kimi, DeepSeek, OpenAI, GLM)
- **Provider/model mismatch diagnosis**: detects when API URL and model name belong to different providers
- **Model name normalization** (`src/api/modelNameUtils.ts`): detects hidden zero-width characters, special dashes (en/em dash), trailing spaces
- **Model list probe** (`src/api/modelListProbe.ts`): probes /v1/models to check if the current model exists in the provider's model list
- **Models proxy** (`api/models-proxy.ts`): Vercel Serverless proxy for /v1/models (never exposes API keys)
- **Provider Diagnosis panel** in Settings Debug Panel: shows inferred provider, confidence, errors, warnings, suggestions
- **Model Name Diagnostics panel**: shows original vs normalized model name and any warnings
- **Model List Probe panel**: shows whether /v1/models is supported and if current model is in the list
- **Request body shape diagnostics** in ai-proxy: reports model, messageCount, hasSystemRole, hasTemperature, etc.
- **Kimi / Moonshot preset** in Settings quick config

### Changed
- **Smoke test variant order**: most minimal payload first (model + messages only), then progressively add parameters
- **Settings error copy**: prioritizes provider/model mismatch before generic HTTP 500 messages
- **MiMo preset note**: warns against using Kimi model names with MiMo endpoint
- **Custom Gateway preset note**: clarified to use gateway's own endpoint and model id

### Fixed
- Users entering Xiaomi endpoint with Kimi model name now see specific mismatch warning instead of generic HTTP 500
- Hidden unicode dash / zero-width characters in model names are now detected and normalized
- Debug panel now shows model availability checks via /v1/models
- HTTP 500 error messages now include provider-specific context

### Not Changed
- Agent Runtime (`src/agent-v4/`)
- ProductBrief schema
- API Required policy
- localStorage project history
- No mock/local-rule fallback

---

## V5.4 — Provider-Compatible Smoke Test Patch (2026-06-03)

### Added
- **Multi-variant smoke test**: 6 different payload variants for maximum provider compatibility
- `src/api/smokeTestPayloads.ts` — defines 6 variants (user_json_minimal, user_plain_minimal, user_json_no_temperature, user_json_no_max_tokens, user_json_max_completion_tokens, messages_plain_no_extra_params)
- `src/api/providerSmokeTest.ts` — orchestrates multi-variant testing with early stop on fatal errors
- **MiMo / 小米 preset** in Settings quick config
- **Attempts table** in Debug Panel showing all variant results
- `variantId` field in apiHealth smokeTest type
- Model name hint when all variants fail (404/500)

### Changed
- Smoke test now tries multiple payload variants automatically (UI shows single button)
- Debug Panel shows all attempts with variant name, HTTP status, error category, duration, preview
- URL self-test moved to collapsed "高级诊断" section
- Error messages now explain provider compatibility issues for HTTP 500

### Fixed
- HTTP 500 from third-party gateways (MiMo etc.) caused by incompatible max_tokens/temperature parameters
- Single payload variant failing on provider-specific API quirks
- Chinese prompt in smoke test causing compatibility issues

### Not Changed
- Agent Runtime
- API Required policy
- ProductBrief schema
- localStorage project history
- No mock/local-rule fallback

---

## V5.3 — Single API Smoke Test Patch (2026-06-02)

### Added
- Single "测试并保存 API" button replaces 6 separate test buttons
- Minimal Chat Completions smoke test (user message only, no system message)
- `smokeTest` field in `apiHealth.ts` tests type
- Better HTTP 500 provider_internal_error diagnostics with category-specific messages
- Collapsible API Debug Panel (default collapsed)
- `buildSmokeTestErrorMessage()` — category-aware error messages for 7 error types

### Changed
- Settings no longer requires Long JSON / Reference Validation to mark API ready
- API Ready is based on minimal non-empty model response (smoke test)
- `assertApiFullyReady()` now delegates to `assertApiReady()` (smoke test is sufficient)
- Long JSON moved to optional (removed from main UI)
- Removed confusing multi-step test UI (Proxy Health, Raw Chat, Quick Ping, JSON Test, Long JSON, Reference Validation)
- Status labels simplified: "API 可用" / "API 不可用" / "未配置"
- FAQ updated to reflect new smoke test approach

### Fixed
- Provider HTTP 500 during Long JSON causing whole API status to fail
- API usable but marked unavailable due to complex validation test
- Confusing status copy about Quick Ping / JSON / Long JSON requirements

### Not Changed
- Agent Runtime (`src/agent-v4/`)
- API Required policy (`ApiRequiredGate`)
- ProductBrief schema
- localStorage project history
- No mock/local-rule fallback restored

---

## V5.2 — Real Agent Workflow Runtime Upgrade (2026-06-02)

### Added
- **AgentTaskGraph** — 9-task decision workflow graph with status tracking and progress computation
- **AgentTask / AgentStep / AgentObservation / HumanApproval** — structured agent workflow data types
- **TaskGraph Runtime** (`taskGraphRuntime.ts`) — main agent workflow engine with LLM planner integration
- **Task Graph Store** (`taskGraphStore.ts`) — localStorage persistence with safety caps (80 tasks, 200 observations, 200 toolCalls)
- **Task Planner** (`taskPlanner.ts`) — generates initial 9 decision tasks from raw idea
- **Task Graph Prompt Builder** (`taskGraphPromptBuilder.ts`) — builds LLM prompts with skill/memory context
- **12 real internal tools** with permission metadata:
  - `inspectBriefContext` (read) — reads Brief context
  - `evaluateRequirementQualityTool` (read) — 8-dimension quality scoring
  - `detectAmbiguityTool` (read) — fuzzy pattern detection
  - `deriveScopeControlTool` (generate_artifact) — P0/P1/P2/Out of Scope
  - `generateEarsCriteriaTool` (generate_artifact) — EARS acceptance criteria
  - `buildDevSpecTool` (generate_artifact) — generates DEV_SPEC
  - `buildCodexTaskPackTool` (generate_artifact) — generates CODEX_TASK_PACK
  - `validateCodexTaskPackTool` (read) — validates task pack completeness
  - `createObservationTool` (write_state) — creates observation records
  - `requestHumanApprovalTool` (write_state) — creates approval requests
  - `writeDecisionMemoryTool` (write_state) — writes decision memories
  - `createSkillFromDecisionTool` (write_state) — creates reusable skills
- **Tool permission metadata** — `permissionLevel`, `sideEffect`, `requiresApproval` on all tools
- **Human Approval Gate** (`humanApproval.ts`) — approve/reject flow for key decisions
- **Skill Library** (`skillLibrary.ts`) — 6 preset skills + find/save/list API
- **Memory Runtime** (`memoryRuntime.ts`) — TaskGraph-specific memory with relevance scoring
- **Task Graph Panel** — shows task graph progress and task list in sidebar
- **Tool Calls Panel** — shows recent 20 tool calls with status and metadata
- **Observations Panel** — shows recent 20 observations with evidence and risks
- **Approvals Panel** — shows pending/resolved approvals with approve/reject buttons
- **DecisionOutputPage Agent Execution Trace** — shows task completion, tool calls, observations, approvals, skills, memories
- **13 new event types** for TaskGraph operations (task_graph_created, tool_call_started, observation_created, approval_requested, etc.)

### Changed
- **AgentWorkspacePageV4** now uses `runAgentTaskGraphTurn` as primary agent workflow (with legacy fallback)
- Default tab changed to "任务图" (TaskGraph)
- Version label updated to V5.2
- Empty state message updated to reflect TaskGraph workflow
- **Tool Registry** upgraded with `permissionLevel`, `sideEffect`, `requiresApproval` metadata on all 13 existing tools

### Fixed
- Agent behavior no longer appears as simple prompt-response loop
- Tool results now become structured Observations
- Key decisions require human confirmation before proceeding

### Not Done
- No shell execution
- No actual MCP server
- No database (localStorage only)
- No vector memory (keyword matching)
- No external GitHub write tools
- No multi-user collaboration
- No background agent execution

---

## V5.2 — API 500 Deep Diagnosis Patch (2026-06-01)

### Added
- `GET /api/ai-proxy` health check — verifies proxy function is alive + runs endpoint normalizer self-test
- Structured upstream error response with `errorCategory`, `upstreamBodyPreview`, `endpointDiagnostics`, `requestDiagnostics`
- Proxy internal error JSON wrapper — any proxy crash returns JSON, never raw Vercel HTML
- `src/api/apiErrorParser.ts`: unified error parser (`parseApiProxyError`, `classifyParsedApiErrorToAIErrorType`, `buildUserFacingApiErrorMessage`)
- API Debug Panel on Settings — shows `inputApiUrl`, `normalizedEndpoint`, `endpointKind`, `model`, `httpStatus`, `errorCategory`, `upstreamBodyPreview`
- Raw Chat Test — minimal `Say OK` request to verify basic connectivity without JSON requirements
- Proxy Health button — `GET /api/ai-proxy` health check before running other tests
- Compatibility options: "Disable system message" checkbox for third-party gateways
- Error category classification: `auth_error`, `permission_error`, `model_not_found`, `quota_or_rate_limit`, `provider_internal_error`, `bad_request`, `upstream_unavailable`, `proxy_internal_error`
- Upstream body preview (max 1200 chars) in all test error responses
- `errorCategory`, `errorMessage`, `upstreamBodyPreview`, `rawResponsePreview` fields in `AITimingDiagnostic`

### Changed
- **All Settings tests now use `parseApiProxyError`** — no more raw `HTTP 500` display
- Quick Ping body simplified: single user message, no system message by default
- `evaluate.ts` `callAIProxy` uses `parseApiProxyError` for structured error handling
- `api/ai-proxy.ts`: refactored into `handleHealthCheck()` + `handleProxyRequest()` with outer try-catch
- `vite.config.ts`: local proxy now supports GET health check + structured upstream errors
- Test order: Proxy Health → Raw Chat → Quick Ping → JSON Test → Long JSON → Reference Validation
- Tests disabled when Proxy Health fails (with clear error message)

### Fixed
- **Settings only showing "HTTP 500" without real upstream error reason**
- **Non-JSON upstream errors being swallowed** — now shows body preview
- **Inability to distinguish proxy crash from provider 500** — `proxy_internal_error` vs `provider_internal_error`
- **Proxy crash returning Vercel HTML** — now always returns JSON
- Weak diagnostics for third-party OpenAI-compatible gateways

### Not Changed
- Agent runtime business logic
- ProductBrief schema
- API required runtime policy
- localStorage project history

## V5.1 — OpenAI-Compatible URL Normalization Patch (2026-06-01)

### Added
- `shared/endpointNormalizer.ts`: unified endpoint normalizer used by frontend, Vite proxy, and Vercel proxy
- `src/api/endpointNormalizer.ts`: re-export for frontend
- Endpoint Preview card on SettingsPage — shows normalized endpoint, kind, warnings, errors in real-time
- URL compatibility self-test button + results table on SettingsPage
- `runEndpointNormalizerSelfTest()`: covers all user URL formats (root, /v1, /v1/chat, full, double /v1)
- Custom Gateway and LLM Token presets with notes about model name requirements
- `X-Vibe-Normalized-Endpoint`, `X-Vibe-Endpoint-Kind`, `X-Vibe-Endpoint-Warnings` proxy response headers
- `normalizedEndpoint`, `endpointKind`, `endpointWarnings`, `apiUrlInput` fields in `AITimingDiagnostic`
- Last AI Timing panel shows user-input URL, normalized endpoint, endpoint kind, warnings

### Changed
- `api/ai-proxy.ts`: replaced internal `normalizeChatCompletionsEndpoint` with shared normalizer
- `vite.config.ts`: replaced internal `normalizeChatCompletionsEndpoint` with shared normalizer
- `src/api/aiDiagnostics.ts`: added V5.1 fields to `AITimingDiagnostic` interface
- `src/api/evaluate.ts`: reads new V5.1 headers, improved HTTP error messages (401/403/404/429/502/503/504)
- `getAIErrorMessage()`: specific messages for URL duplication, auth errors, rate limits, upstream failures, timeouts
- GLM preset: removed default `/api/paas` URL, now prompts user for correct endpoint
- OpenAI preset: model changed to `gpt-4o-mini`
- API URL input hint: updated to mention root URL and /v1 support

### Fixed
- **`/v1` normalized to `/v1/v1/chat/completions`** — the core bug in api/ai-proxy.ts line 39
- **Local proxy and Vercel proxy used different normalization logic** — now both use `shared/endpointNormalizer.ts`
- **Third-party OpenAI-compatible gateway URLs** (gpt-agent.cc, api.llm-token.cn) now handled correctly
- **Misleading API error messages** — now distinguishes URL errors, key errors, model errors, quota errors, timeouts
- Preset GLM with `/api/paas` URL would always fail — removed

### Not Changed
- Agent runtime business logic
- ProductBrief schema
- localStorage project history
- API required runtime policy
- Mock fallback remains disabled

## V4.9 — API Timeout Diagnosis & Streaming Readiness Patch (2026-05-31)

### Added
- Timeout profile system (`src/api/timeoutProfile.ts`): 7 task-specific profiles (quick_ping, json_test, long_json_test, agent_turn, stage_suggestion, handoff, explain)
- `src/api/aiDiagnostics.ts`: AI timing capture + localStorage persistence
- Quick Ping / JSON Test / Long JSON Test separation on SettingsPage
- API Diagnostics Card with per-test status + last AI timing panel
- `X-Vibe-Proxy-Duration-Ms` / `X-Vibe-Upstream-Endpoint` / `X-Vibe-Upstream-Duration-Ms` / `X-Vibe-Timeout-Ms` proxy response headers
- `basic_ready` API health state (Quick Ping + JSON pass, Agent unlocked)
- `markApiBasicReady()` / `assertApiFullyReady()` / `updateApiHealthTests()` API health functions
- `API_TIMEOUT_DIAGNOSIS.md`: full timeout diagnosis documentation

### Changed
- **Removed 40s hard-coded Settings timeout** — now 12s (Quick Ping), 30s (JSON Test), 90s (Long JSON)
- **Removed 50s proxy hard limit** — now configurable via `AI_PROXY_MAX_TIMEOUT_MS` env var (default 120s)
- `api/ai-proxy.ts`: `config.maxDuration` → 120 (was 55)
- `vercel.json`: `maxDuration` → 120 (was 55)
- **Removed per-request proxy preflight** from `callAIProxy` — saves ~5s per AI call
- `callAIProxy` now records timing diagnostics + saves to localStorage
- Agent Runtime `callCopilotJson` uses `agent_turn` timeout profile (90s, 900 tokens, was 60s/1500t)
- Handoff `optimizeHandoff` uses handoff timeout (120s, 1400 tokens, was 50s/2400t)
- `apiHealth.ts`: new states `proxy_failed`, `quick_ping_failed`, `long_json_failed`, `basic_ready`
- `ApiRequiredGate`: supports all new health states
- `AgentWorkspacePageV4` header: shows "Basic" badge for `basic_ready`

### Fixed
- **Official API timing out due to project-side 40s/50s abort** — root cause: browser AbortSignal and proxy cap
- **Misleading timeout error copy** — now task-specific messages distinguish connection failure vs JSON failure vs long output timeout
- **Long JSON test blocking basic API diagnosis** — layered test architecture
- V4.4 incompatible `connection_failed` → removed from type union

### Deployment Notes
- Vercel Hobby still capped at 60s even with 120s config; set `AI_PROXY_MAX_TIMEOUT_MS=50000` in Vercel env vars for Hobby
- Vercel Pro users get full 120s support
- localStorage keys unchanged — no data migration needed

---

## V4.8 — Minimal Apple Monochrome UI Cleanup (2026-05-30)

### Added
- Theme system: system/light/dark (src/lib/theme.ts)
- ThemeToggle component (src/components/ThemeToggle.tsx)
- Unified Apple-style design tokens (--vp-bg, --vp-surface, --vp-text, --vp-border, --vp-accent)

### Changed
- CSS complete rewrite: multi-color system → black/white/gray + accent blue only
- Old tokens mapped to new tokens for backward compatibility
- Cards/buttons/inputs unified to single system (removed duplicate variants)
- Aurora background simplified (colored orbs → display:none)
- Traffic lights: colored → monochrome gray
- Gradient titles and progress bars → solid colors
- All color glow effects removed

### Fixed
- Visual inconsistency across pages (3 color systems coexisting)
- Over-designed gradient and glass effects competing for attention
- Missing theme persistence (system/light/dark)
- CSS file size reduced by 15% (-5KB)

### Not Changed
- Agent Runtime, API calls, localStorage schema
- No new UI library, no Framer Motion

---

## V4.6 — Liquid Glass Visual System Upgrade (2026-05-29)

### Added
- Liquid component system (10 components: AuroraBackground, LiquidShell, LiquidCard, LiquidButton, LiquidInput, LiquidBadge, LiquidProgress, LiquidStepRail, LiquidDock, PageReveal)
- iOS-inspired color tokens (blue/indigo/purple/cyan/mint/green/orange/red)
- Dark mode support (prefers-color-scheme: dark)
- Aurora wallpaper background with ambient orbs
- Glass card system with saturate(180%) backdrop-filter
- Accessibility: prefers-reduced-motion, prefers-contrast, backdrop-filter fallback
- Motion primitives: page reveal, card hover lift, button scale

### Changed
- Color palette: Coral/Navy/Sage → iOS Blue/Indigo/Purple
- LandingPage: added Core Loop timeline, "Why Not PRD" comparison, Interview section
- NewIdeaPage: iOS onboarding style with segmented control
- AgentWorkspacePageV4: macOS titlebar, glass conversation bubbles, AI status chips, Spotlight input
- DecisionOutputPage: 8-dimension quality score grid, document-style cards
- DeveloperHandoffPage: LiquidCard sections, macOS code blocks
- SettingsPage: centered glass panel, glow API status
- HistoryPage: "Recent Decision Specs" gallery layout
- Button colors: coral → iOS blue (#007aff)

### Fixed
- Inconsistent visual hierarchy across pages
- Low product portfolio feel (demo → AI product)
- Weak page narrative (hero-only → full story)
- Missing dark mode support
- Missing accessibility media queries

### Not Changed
- Agent Runtime, API calls, localStorage schema — zero business logic changes
- Old four-step workflow pages (DemandDiscovery, ProductFraming, etc.)
- No new UI library, no Framer Motion

---

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
