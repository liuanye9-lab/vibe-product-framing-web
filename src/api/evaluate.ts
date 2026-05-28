import type {
  AiSuggestion,
  BusinessRoi,
  BusinessFramingState,
  CopilotStages,
  DemandDiscoveryState,
  EvaluateIdeaResult,
  FinalHandoff,
  FramingStage,
  IdeaInputState,
  MvpScopeState,
  ProductBrief,
  ProductFramingState,
  BlindSpotReviewState,
  StepData,
  SuggestionValue,
  TechnicalPlanningState,
} from '../types';
import type { StepConfig } from '../data/steps';
import { buildBriefContext, buildSuggestStagePrompt } from '../prompts/suggestStagePrompt';
import { buildCompactStageContext } from '../prompts/stageContext';
import { buildMvpScopePrompt } from '../prompts/mvpScopePrompt';
import { buildExplainSuggestionPrompt } from '../prompts/explainSuggestionPrompt';
import { buildOptimizeHandoffPrompt } from '../prompts/optimizeHandoffPrompt';
import { SCOPE_CREEP_TERMS } from '../skill/systemRules';
import { retrieveKnowledge } from '../knowledge/retrieveKnowledge';
import { buildDevSpec } from '../knowledge/templates/devSpecTemplate';
import { buildKnowledgeEnhancedCodexPrompt } from '../knowledge/templates/codexPromptTemplate';
import { evaluateHandoff } from '../evaluation/evaluateHandoff';
import { buildStructuredDevSpec } from '../spec/buildStructuredDevSpec';
import { formatStructuredDevSpecMarkdown } from '../spec/formatStructuredDevSpecMarkdown';

// --- AI Error Types ---

export type AIErrorType =
  | 'connection'
  | 'timeout'
  | 'http'
  | 'empty'
  | 'json_parse'
  | 'validation'
  | 'unknown';

export class VibeAIError extends Error {
  type: AIErrorType;
  detail?: unknown;
  rawContent?: string;
  constructor(
    type: AIErrorType,
    message: string,
    options?: { cause?: unknown; detail?: unknown; rawContent?: string },
  ) {
    super(message);
    this.name = 'VibeAIError';
    this.type = type;
    this.detail = options?.detail;
    this.rawContent = options?.rawContent;
    if (options?.cause) this.cause = options.cause;
  }
}

/** User-friendly error messages per AIErrorType */
export function getAIErrorMessage(error: unknown): string {
  if (error instanceof VibeAIError) {
    switch (error.type) {
      case 'connection':
        return 'API 连接失败：请检查 API URL、网络、部署环境和服务商状态。';
      case 'timeout':
        return '模型响应超时：当前任务输出较长。建议换更快模型，或稍后重试。';
      case 'http':
        return `上游 API 返回错误：${error.message.replace(/^AI API 返回错误\s*\(?\d*\)?\s*:\s*/, '')}。请检查 API key、余额、模型名和 endpoint。`;
      case 'empty':
        return '模型已响应但没有返回内容。请检查模型是否支持该请求格式。';
      case 'json_parse':
        return '模型已响应，但没有返回有效 JSON。建议换更稳定模型或降低输出长度。';
      case 'validation':
        return `模型已响应，但输出与当前产品想法关联不足：${error.message}。可以重新生成，或使用本地规则版。`;
      case 'unknown':
      default:
        return `未知错误：${error.message}`;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/** Check if an error is a VibeAIError of a specific type */
export function isVibeAIError(error: unknown, type?: AIErrorType): error is VibeAIError {
  return error instanceof VibeAIError && (type === undefined || error.type === type);
}

// --- AI Configuration (from localStorage) ---

export interface AIConfig {
  apiUrl: string;     // e.g. https://api.openai.com
  apiKey: string;     // e.g. sk-xxx
  model: string;      // e.g. gpt-4o
}

export type AIConnectionStatus = 'unconfigured' | 'connected' | 'failed';

const AI_CONFIG_KEY = 'vibepilot_ai_config';
const AI_CONNECTION_STATUS_KEY = 'vibepilot_ai_connection_status';
const AI_CACHE_KEY = 'vibepilot_ai_response_cache_v1';
const AI_NOT_READY_MESSAGE = 'AI 模型未连接成功。请先进入设置页完成配置并测试连接，否则无法生成有效分析。';
/**
 * V4.4: Mock fallback is permanently disabled.
 * All core workflows must use real API. No local-rule or mock substitutes.
 */
const ENABLE_MOCK_FALLBACK = false;

export function normalizeApiUrl(apiUrl: string): string {
  return apiUrl.trim().replace(/\/+$/, '');
}

export function getAIConfig(): AIConfig | null {
  try {
    const raw = localStorage.getItem(AI_CONFIG_KEY);
    if (!raw) return null;
    const config = JSON.parse(raw) as AIConfig;
    if (!config.apiUrl || !config.apiKey || !config.model) return null;
    return {
      apiUrl: normalizeApiUrl(config.apiUrl),
      apiKey: config.apiKey.trim(),
      model: config.model.trim(),
    };
  } catch {
    return null;
  }
}

export function saveAIConfig(config: AIConfig): void {
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify({
    apiUrl: normalizeApiUrl(config.apiUrl),
    apiKey: config.apiKey.trim(),
    model: config.model.trim(),
  }));
}

export function clearAIConfig(): void {
  localStorage.removeItem(AI_CONFIG_KEY);
  saveAIConnectionStatus('unconfigured');
}

export function getAIConnectionStatus(): AIConnectionStatus {
  const status = localStorage.getItem(AI_CONNECTION_STATUS_KEY);
  if (status === 'connected' || status === 'failed' || status === 'unconfigured') return status;
  return getAIConfig() ? 'failed' : 'unconfigured';
}

export function saveAIConnectionStatus(status: AIConnectionStatus): void {
  localStorage.setItem(AI_CONNECTION_STATUS_KEY, status);
}

export function isAIReady(): boolean {
  return Boolean(getAIConfig()) && getAIConnectionStatus() === 'connected';
}

export function requireAIConfig(): AIConfig {
  const config = getAIConfig();
  if (!config) {
    throw new Error('未配置 AI 模型。请先到设置页配置 API URL、API Key 和模型名称，并测试连接成功后再使用。');
  }
  return config;
}

export function requireAIReady(): AIConfig {
  if (!isAIReady()) {
    throw new Error(AI_NOT_READY_MESSAGE);
  }
  return requireAIConfig();
}

// --- Request Types ---

interface EvaluateRequest {
  step: StepConfig;
  userAnswer: string;
  rawIdea: string;
  allSteps: Record<string, StepData>;
  mode?: 'evaluate' | 'hint' | 'followup';
  previousEvaluation?: string;
}

interface EvaluateResponse {
  evaluation: string;
  quality: 'specific' | 'ok' | 'vague';
  followUp: string;
  source?: 'ai' | 'mock' | 'local-rule';
}

// --- Direct AI Call (OpenAI-compatible via same-origin proxy) ---

export function extractAIContent(data: Record<string, unknown>): string {
  let content = '';
  const choices = data.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const firstChoice = choices[0] as Record<string, unknown>;
    // Standard OpenAI format
    if (firstChoice.message && typeof (firstChoice.message as Record<string, unknown>).content === 'string') {
      content = (firstChoice.message as Record<string, unknown>).content as string;
    }
    // Some providers wrap in delta
    else if (firstChoice.delta && typeof (firstChoice.delta as Record<string, unknown>).content === 'string') {
      content = (firstChoice.delta as Record<string, unknown>).content as string;
    }
    // Direct content field
    else if (typeof firstChoice.content === 'string') {
      content = firstChoice.content;
    }
  }
  // Gemini / some providers may return content directly
  else if (typeof data.content === 'string') {
    content = data.content;
  }
  // Some providers return candidates
  else if (Array.isArray(data.candidates) && data.candidates.length > 0) {
    const candidate = data.candidates[0] as Record<string, unknown>;
    const candidateContent = candidate.content;
    if (candidateContent && typeof (candidateContent as Record<string, unknown>).text === 'string') {
      content = (candidateContent as Record<string, unknown>).text as string;
    } else if (candidateContent && Array.isArray((candidateContent as Record<string, unknown>).parts)) {
      content = ((candidateContent as Record<string, unknown>).parts as Array<Record<string, unknown>>)
        .map((part) => (typeof part.text === 'string' ? part.text : ''))
        .join('');
    }
  }

  return content.trim();
}

const DEFAULT_AI_TIMEOUT_MS = 90000;
const SUGGEST_AI_TIMEOUT_MS = 120000;
const EXPLAIN_AI_TIMEOUT_MS = 60000;
const HANDOFF_AI_TIMEOUT_MS = 180000;

/** Max retry attempts for transient network failures */
const MAX_FETCH_RETRIES = 3;
/** Base delay between retries (ms), multiplied by attempt number */
const RETRY_BASE_DELAY_MS = 1000;

/**
 * Classify a fetch/Network error into a diagnostic category.
 * Returns a human-readable category and whether it's likely retryable.
 */
function classifyNetworkError(err: unknown): { category: string; retryable: boolean; userAdvice: string } {
  const msg = String(err instanceof Error ? err.message : err).toLowerCase();

  // Network offline / DNS failure
  if (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('failed to get response') ||
    msg.includes('load failed')
  ) {
    return {
      category: 'NETWORK_FAILURE',
      retryable: true,
      userAdvice:
        '网络请求失败。可能原因：1) 网络断开或切换了网络；2) API 代理服务未启动（本地开发需运行 npm run dev）；3) Vercel 部署未完成（线上环境需确认部署成功）；4) 浏览器插件拦截了请求。',
    };
  }

  // Abort / timeout
  if (msg.includes('abort') || msg.includes('timeout')) {
    return {
      category: 'TIMEOUT',
      retryable: false,
      userAdvice: '请求超时被中断。可能是模型响应时间过长或手动取消了操作。',
    };
  }

  // CORS (shouldn't happen for same-origin /api but just in case)
  if (msg.includes('cors') || msg.includes('cross-origin')) {
    return {
      category: 'CORS',
      retryable: false,
      userAdvice: '跨域请求被拒绝。这通常是配置问题，请检查 Vercel 部署设置。',
    };
  }

  // SSL/TLS
  if (msg.includes('ssl') || msg.includes('tls') || msg.includes('certificate')) {
    return {
      category: 'SSL',
      retryable: false,
      userAdvice: 'SSL/TLS 连接失败，可能是证书问题或中间人攻击。',
    };
  }

  // Server returned error
  if (msg.includes('502') || msg.includes('503') || msg.includes('504') || msg.includes('bad gateway') || msg.includes('unavailable')) {
    return {
      category: 'UPSTREAM_UNAVAILABLE',
      retryable: true,
      userAdvice: 'AI 代理服务暂时不可用（502/503/504）。通常是因为：Vercel Edge Function 冷启动失败、上游 AI API 过载或不可达。',
    };
  }

  return {
    category: 'UNKNOWN',
    retryable: true,
    userAdvice: `未知网络错误：${err instanceof Error ? err.message : String(err)}。建议刷新页面后重试。`,
  };
}

/**
 * Check if the AI proxy endpoint is reachable by sending a lightweight preflight.
 * Returns true if the proxy seems available.
 */
async function checkProxyReachable(attempt = 1): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch('/api/ai-proxy', {
      method: 'OPTIONS',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
    });
    clearTimeout(timer);
    // 405 is fine — means endpoint exists (OPTIONS not allowed, POST works)
    return res.status === 405 || res.status < 500;
  } catch {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 1000));
      return checkProxyReachable(attempt + 1);
    }
    return false;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isLikelyTimeout(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'TimeoutError') return true;
  if (error instanceof Error && error.name === 'TimeoutError') return true;
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('超时') ||
    message.includes('aborted') ||
    message.includes('abort')
  );
}

function abortSignalTimeout(timeoutMs: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs);
  }

  const controller = new AbortController();
  window.setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

async function callAIProxy(config: AIConfig, body: Record<string, unknown>, timeoutMs = DEFAULT_AI_TIMEOUT_MS): Promise<Record<string, unknown>> {
  const startedAt = performance.now();
  console.log('[VibePilot] AI Proxy Request:', { apiUrl: config.apiUrl, model: body.model, timeoutMs });
  const clientTimeoutMs = timeoutMs + 15000;

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_FETCH_RETRIES; attempt++) {
    try {
      // Before first attempt, do a quick proxy reachability check
      if (attempt === 1) {
        const reachable = await checkProxyReachable();
        if (!reachable) {
          console.warn('[VibePilot] Proxy preflight check failed — proceeding with request anyway');
        }
      }

      const response = await fetch('/api/ai-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortSignalTimeout(clientTimeoutMs),
        body: JSON.stringify({
          apiUrl: config.apiUrl,
          apiKey: config.apiKey,
          body,
          timeoutMs,
        }),
      });

      const rawText = await response.text();
      const durationMs = Math.round(performance.now() - startedAt);
      console.log('[VibePilot] AI Proxy Response:', {
        model: body.model,
        timeoutMs,
        durationMs,
        status: response.status,
        responseChars: rawText.length,
        attempt,
      });
      console.log('[VibePilot] AI Proxy Raw Response:', rawText.slice(0, 500));

      if (!response.ok) {
        let parsedError: unknown;
        try {
          parsedError = JSON.parse(rawText) as unknown;
        } catch {
          parsedError = null;
        }

        const errorObject = parsedError && typeof parsedError === 'object' ? parsedError as Record<string, unknown> : null;
        const errorValue = errorObject?.error;
        const errorMessage = typeof errorValue === 'string'
          ? errorValue
          : errorValue && typeof errorValue === 'object' && typeof (errorValue as Record<string, unknown>).message === 'string'
            ? (errorValue as Record<string, unknown>).message as string
            : rawText.slice(0, 300);

        throw new VibeAIError('http', `AI API 返回错误 (${response.status}): ${errorMessage}`);
      }

      try {
        return JSON.parse(rawText) as Record<string, unknown>;
      } catch {
        throw new VibeAIError('json_parse', 'AI API 返回的不是有效 JSON', { rawContent: rawText.slice(0, 500) });
      }
    } catch (err) {
      lastError = err;
      const diagnosis = classifyNetworkError(err);

      console.warn(`[VibePilot] AI Proxy attempt ${attempt}/${MAX_FETCH_RETRIES} failed [${diagnosis.category}]:`, err);

      // Don't retry non-retryable errors (aborts, CORS)
      if (!diagnosis.retryable || attempt >= MAX_FETCH_RETRIES) {
        break;
      }

      // Exponential backoff before retry
      const delay = RETRY_BASE_DELAY_MS * attempt;
      console.warn(`[VibePilot] Retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  // All retries exhausted — throw classified error
  const diagnosis = classifyNetworkError(lastError);
  const errorType: AIErrorType = diagnosis.category === 'TIMEOUT' ? 'timeout' : 'connection';
  const userMessage = `${diagnosis.userAdvice}\n\n原始错误：${lastError instanceof Error ? lastError.message : String(lastError)}`;
  throw new VibeAIError(errorType, userMessage, { cause: lastError });
}

function buildSystemPrompt(req: EvaluateRequest): string {
  const { step, userAnswer, rawIdea, allSteps, mode, previousEvaluation } = req;
  const stepKey = step.key;
  const stepTitle = step.title;
  const stepQuestion = step.question;

  const prevSteps = Object.entries(allSteps || {})
    .filter(([key, val]) => key !== stepKey && val.userAnswer)
    .map(([key, val]) => `- ${key}: ${val.userAnswer.slice(0, 200)}`)
    .join('\n');

  if (mode === 'hint') {
    return `你是一位资深产品经理，正在指导一个 vibe coding 新手完成产品思考练习。

当前步骤：${stepTitle}
问题描述：${stepQuestion}
用户的原始想法：${rawIdea}

用户说"我不知道怎么写"，请给他一个具体的思考方向提示。
要求：
1. 不要直接给出答案，而是给出思考路径
2. 用 2-3 个具体问题引导用户自己思考
3. 语气友好、鼓励，像一个耐心的高手带徒弟
4. 控制在 100 字以内
5. 用中文回答`;
  }

  if (mode === 'followup') {
    return `你是一位资深产品经理。用户刚刚收到了你的评价，现在在追问环节想继续深入。

当前步骤：${stepTitle}
用户之前的答案：${userAnswer}
你之前的评价：${previousEvaluation}

用户想要继续追问，请给他一个有价值的追问或思考方向。
要求：
1. 基于之前的评价，提出更深一层的问题
2. 不要重复之前的内容
3. 控制在 80 字以内
4. 用中文回答`;
  }

  return `你是一位资深产品经理，正在评价一个 vibe coding 新手的产品思考练习答案。

## 当前步骤
步骤名：${stepTitle}
问题描述：${stepQuestion}

## 用户的原始想法（产品方向）
${rawIdea}

${prevSteps ? `## 用户之前完成的步骤\n${prevSteps}\n` : ''}

## 用户的当前答案
${userAnswer}

## 评价要求

请严格按以下 JSON 格式返回，不要输出任何其他内容，不要使用 markdown 代码块包裹：
{
  "quality": "specific" | "ok" | "vague",
  "evaluation": "评价文本",
  "followUp": "追问文本"
}

### quality 判断标准
- specific：答案包含具体的数字、场景细节、特定人群描述、可量化指标，或者结构清晰（使用了列表/编号）
- ok：方向正确但缺少具体细节，只有定性描述没有定量数据，或者覆盖面不够全
- vague：答案过于宽泛（如"所有人""提高效率""智能化"），没有具体信息，或者字数太少（< 20 字）

### evaluation 评价要求
1. 先说结论（好/还行/太模糊），再说原因
2. 引用用户答案中的具体内容（如果有的话），让用户感觉你真的看了他写的东西
3. ${prevSteps ? '检查是否和之前步骤矛盾（比如之前说不需要后端，这里却写了注册登录），如果有矛盾要指出来。' : ''}
4. 给出具体的改进方向，不要空话
5. 控制在 100-150 字
6. 用中文

### followUp 追问要求
1. 提一个具体的、可回答的问题
2. 问题应该引导用户把答案从"ok"提升到"specific"
3. 如果是 vague 等级，追问应该帮用户找到切入点
4. 控制在 50 字以内
5. 用中文`;
}

async function callDirectAI(req: EvaluateRequest, config: AIConfig): Promise<EvaluateResponse> {
  const allStepsSummary: Record<string, { userAnswer: string; aiQuality: string }> = {};
  for (const [key, val] of Object.entries(req.allSteps)) {
    allStepsSummary[key] = {
      userAnswer: val.userAnswer,
      aiQuality: val.aiQuality || 'vague',
    };
  }

  const systemPrompt = buildSystemPrompt(req);

  const userMessage = req.mode === 'evaluate'
    ? req.userAnswer
    : req.mode === 'hint'
      ? '我不知道怎么回答这个问题，请给我一些提示方向。'
      : '我想继续追问，请帮我深入思考。';

  const requestBody: Record<string, unknown> = {
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
    max_tokens: req.mode === 'evaluate' ? 500 : 200,
  };

  const data = await callAIProxy(config, requestBody, DEFAULT_AI_TIMEOUT_MS);
  const content = extractAIContent(data);

  console.log('[VibePilot] Extracted content:', content.slice(0, 200));

  if (!content) {
    throw new Error('模型返回为空，请检查模型名称是否正确。响应结构：' + Object.keys(data).join(', '));
  }

  if (req.mode === 'hint') return { evaluation: content, quality: 'ok', followUp: '', source: 'ai' };

  if (req.mode === 'followup') return { evaluation: '', quality: 'ok', followUp: content, source: 'ai' };

  // Parse JSON from AI response (evaluate mode)
  let result: EvaluateResponse;
  try {
    // Use balanced brace matching instead of greedy regex for reliability
    const balanced = findBalancedBraces(content);
    const jsonStr = balanced || content;
    const cleaned = removeTrailingCommas(stripComments(stripMarkdownFences(jsonStr)));
    result = JSON.parse(cleaned);
    if (!['specific', 'ok', 'vague'].includes(result.quality)) {
      result.quality = 'ok';
    }
  } catch {
    const lowerContent = content.toLowerCase();
    let quality: 'specific' | 'ok' | 'vague' = 'ok';
    if (lowerContent.includes('具体') || lowerContent.includes('清晰') || lowerContent.includes('很好')) {
      quality = 'specific';
    } else if (lowerContent.includes('模糊') || lowerContent.includes('宽泛') || lowerContent.includes('太笼统')) {
      quality = 'vague';
    }
    result = {
      quality,
      evaluation: content.replace(/\{[\s\S]*\}/, '').trim() || '评价生成失败，请重试。',
      followUp: '',
    };
  }

  return { ...result, source: 'ai' };
}

// --- Local Mock (Fallback when no AI config) ---

function judgeQuality(answer: string, stepKey: string): 'specific' | 'ok' | 'vague' {
  if (!answer || answer.trim().length < 10) return 'vague';

  const vaguePatterns = [
    '所有人', '大家', '用户', '提高效率', '更好用', '用户体验',
    '智能化', '自动化', '一站式', '全方位', '综合',
  ];
  const isVague = vaguePatterns.some((p) => answer.includes(p)) && answer.length < 30;

  const hasConcrete =
    (/\d/.test(answer) && answer.length > 30) ||
    (answer.length > 60 && /[，,。.；;]/.test(answer));

  if (stepKey === 'mvpScope' || stepKey === 'acceptanceCriteria') {
    const hasList = /\d[.)）]/.test(answer) || /P0|P1|P2/i.test(answer) || /\n/.test(answer);
    if (hasList && answer.length > 40) return 'specific';
    if (answer.length > 20) return 'ok';
    return 'vague';
  }

  if (stepKey === 'techStack') {
    const hasTech = /react|vue|node|python|tailwind|next|vite|api|数据库|localStorage/i.test(answer);
    if (hasTech && answer.length > 30) return 'specific';
    if (hasTech) return 'ok';
    return 'vague';
  }

  if (stepKey === 'dataStructure') {
    const hasFields = /\{.*\}/.test(answer) || /字段|id|name|email|title/i.test(answer);
    if (hasFields && answer.length > 30) return 'specific';
    if (hasFields) return 'ok';
    return 'vague';
  }

  if (isVague) return 'vague';
  if (hasConcrete) return 'specific';
  if (answer.length > 30) return 'ok';
  return 'vague';
}

const EVAL_TEMPLATES: Record<string, Record<string, { evaluation: string; followUp: string }[]>> = {
  targetUser: {
    specific: [
      { evaluation: '很清晰！你描述了用户的身份、经验和当前困境，这个用户画像足够具体。', followUp: '这类用户最有可能通过什么渠道发现你的产品？' },
      { evaluation: '用户画像很具体。我能想象出这个人——知道他是谁、做什么、遇到了什么困难。', followUp: '他们的付费意愿和能力如何？' },
    ],
    ok: [
      { evaluation: '方向对了，但还可以更具体。尝试补充用户的经验水平和当前使用的工具。', followUp: '他们的经验水平是什么？当前用什么方式解决类似问题？' },
    ],
    vague: [
      { evaluation: '这个描述太宽泛了。"所有人"或"需要XX的人"不是用户画像。', followUp: '闭上眼睛，想象你的第一个真实用户——他叫什么、做什么工作、今天遇到了什么？' },
    ],
  },
  scenario: {
    specific: [
      { evaluation: '场景很清晰！我能想象出用户在那个时刻遇到了什么障碍。', followUp: '用户在这个场景中的情绪是什么？' },
    ],
    ok: [
      { evaluation: '大致场景有了，但缺少情境细节。好的场景描述应该让人感到"我确实遇到过"。', followUp: '用"微电影"思维重写：镜头从哪里开始？转折点在哪？' },
    ],
    vague: [
      { evaluation: '这不是场景描述。场景应该是"用户在XX时刻，正在做XX事，遇到了XX问题"。', followUp: '用一句话格式重写：[谁]在[什么时候][做什么]的时候，[遇到了什么问题]。' },
    ],
  },
  painPoint: {
    specific: [
      { evaluation: '痛点很真实！你描述了具体的困难、量化的影响。', followUp: '这个痛点发生的频率有多高？' },
    ],
    ok: [
      { evaluation: '痛点方向对了，但需要更具体。', followUp: '试着量化：做这件事要多久？出错率多高？' },
    ],
    vague: [
      { evaluation: '这不是痛点，这是口号。', followUp: '想象用户今天刚遇到这个问题——具体发生了什么？' },
    ],
  },
  alternatives: {
    specific: [
      { evaluation: '很好！你清楚列出了用户的替代方案，说明做过调研。', followUp: '用户最不满意哪个替代方案？' },
    ],
    ok: [
      { evaluation: '方向对了，但可能遗漏了一些替代方案。', followUp: '有没有用户选择"不做这件事"的情况？' },
    ],
    vague: [
      { evaluation: '几乎不存在"完全没有替代方案"的事。', followUp: '问一个真实用户："你现在怎么解决XX问题？"' },
    ],
  },
  aiValue: {
    specific: [
      { evaluation: '很清晰！你说明了 AI 介入的具体环节。', followUp: '如果 AI 生成的结果不好，用户有退路吗？' },
    ],
    ok: [
      { evaluation: '大致说明了 AI 的作用，但还需要更具体。', followUp: '去掉所有"智能"的词，用大白话说输入→处理→输出。' },
    ],
    vague: [
      { evaluation: '"智能分析""自动推荐"是空话。你需要说清楚 AI 在哪个环节做什么。', followUp: '用"输入→处理→输出"的格式重写。' },
    ],
  },
  mvpScope: {
    specific: [
      { evaluation: '功能范围清晰，优先级划分合理。', followUp: '只保留 P0，用户能走完完整流程吗？' },
    ],
    ok: [
      { evaluation: '功能列表有了，但优先级可能不够清晰。', followUp: '砍掉一半功能，你留哪几个？' },
    ],
    vague: [
      { evaluation: '这不是 MVP，这是完整产品规划。V1 的 P0 不应超过 3 个。', followUp: '假设只有 3 天时间，你只能做一件事，你做哪个？' },
    ],
  },
  outOfScope: {
    specific: [
      { evaluation: '很好！说清不做什么和说清做什么一样重要。', followUp: '在"不做"中，哪个你内心最想要？' },
    ],
    ok: [
      { evaluation: '方向对了，但可以更坚定。', followUp: '再加 2 个"不做"的功能。' },
    ],
    vague: [
      { evaluation: '如果你觉得"什么都不排除"，说明 MVP 还是太大。', followUp: '哪个功能最花钱/最耗时/最复杂？标记为"V1 不做"。' },
    ],
  },
  techStack: {
    specific: [
      { evaluation: '技术栈选择很务实！简单、可落地、低成本启动。', followUp: '这个技术栈中你最不熟悉的部分是什么？' },
    ],
    ok: [
      { evaluation: '大致方向有了，但可以更具体。', followUp: '回答 4 个问题：前端？后端？数据存哪？怎么部署？' },
    ],
    vague: [
      { evaluation: '"现代技术"不是架构方案。需要明确每个部分用什么技术。', followUp: '推荐你用最熟悉的 1-2 个技术。' },
    ],
  },
  dataStructure: {
    specific: [
      { evaluation: '数据结构清晰！有了它，代码组织就有了骨架。', followUp: '实体之间有关系吗？' },
    ],
    ok: [
      { evaluation: '方向对了，但字段可以更具体。', followUp: '补充每个实体的字段和类型。' },
    ],
    vague: [
      { evaluation: '这不是数据结构，这是功能列表。', followUp: '用格式：实体名 { 字段名: 类型 } 重写。' },
    ],
  },
  acceptanceCriteria: {
    specific: [
      { evaluation: '验收标准很具体！每条都可测试、可判断。', followUp: '谁来判断这些条件满足？' },
    ],
    ok: [
      { evaluation: '方向对了，但部分标准不够具体。', followUp: '把每条改成"Given...When...Then..."格式。' },
    ],
    vague: [
      { evaluation: '"体验流畅""设计精美"无法测试。', followUp: '把"体验好"改成不超过 X 步、不超过 Y 秒。' },
    ],
  },
};

const STEP_HINTS: Record<string, string[]> = {
  targetUser: [
    '试着回答：1) 用户做什么工作？2) 工作多久了？3) 最大烦恼是什么？4) 用什么工具？',
    '想象你坐在咖啡厅，你的目标用户坐在对面。你会怎么描述这个人？',
  ],
  scenario: [
    '想象一部微电影：用户坐在电脑前，打开了什么网站？他在找什么？哪一步卡住了？',
    '用"时间+地点+人物+动作+障碍"五要素重写。',
  ],
  painPoint: [
    '量化你的痛点：做这件事要多久？一周做几次？出错率多高？',
    '找 3 个真实用户，问他们"做这件事最让你抓狂的是什么？"',
  ],
  alternatives: [
    '做个小调查：找到 3 个目标用户，问"你现在怎么解决XX问题？"',
    '分成 3 类思考：1) 工具类 2) 人工类 3) "不做"类。',
  ],
  aiValue: [
    '画一个流程图：用户输入什么→系统怎么处理→用户得到什么。',
    '回答 3 个问题：1) AI 输入什么？2) AI 输出什么？3) 不用 AI 多花多少时间？',
  ],
  mvpScope: [
    '减法游戏：写下所有功能，每次拿走一张，问"没有它产品还能跑吗？"',
  ],
  outOfScope: [
    '反向思考：哪个最耗时？哪个最复杂？标记为 V1 不做。',
  ],
  techStack: [
    '回答 4 个问题：1) 前端？2) 需要后端吗？3) 数据存哪？4) 怎么部署？',
  ],
  dataStructure: [
    '你的产品管理什么核心"东西"？给它起个英文名，列出属性。',
  ],
  acceptanceCriteria: [
    '想象给朋友演示，把每句话变成一条验收标准。',
  ],
};

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function buildMockResponse(step: StepConfig, answer: string): EvaluateResponse {
  const quality = judgeQuality(answer, step.key);
  const templates = EVAL_TEMPLATES[step.key];
  const variants = templates?.[quality];
  const template = variants ? getRandomItem(variants) : null;

  return {
    evaluation: template?.evaluation || getDefaultEvaluation(quality),
    quality,
    followUp: template?.followUp || getDefaultFollowUp(quality),
    source: 'mock',
  };
}

function getDefaultEvaluation(quality: string): string {
  if (quality === 'specific') return '这个答案很具体，能看出你做了认真的思考。';
  if (quality === 'ok') return '方向不错，但可以更具体。试着加上数字、场景细节或具体案例。';
  return '这个答案太模糊了，几乎适用于任何产品。请想象一个真实用户的具体情况。';
}

function getDefaultFollowUp(quality: string): string {
  if (quality === 'specific') return '这个答案有没有遗漏什么？有没有边界情况没考虑到？';
  if (quality === 'ok') return '试着在答案里加上至少一个数字或具体场景。';
  return '如果只能用一句话、不带任何形容词来描述，你会怎么说？';
}

// --- Copilot AI Capabilities: Evaluate / Suggest / Explain / Optimize ---

export { SCOPE_CREEP_TERMS } from '../skill/systemRules';

function makeSuggestion<T extends SuggestionValue>(
  value: T,
  reason: string,
  risks: string[] = [],
  alternatives: string[] = []
): AiSuggestion<T> {
  return {
    value,
    reason,
    risks,
    alternatives,
    accepted: false,
    editedByUser: false,
    source: 'mock',
  };
}

function acceptedText(value: AiSuggestion | undefined): string {
  if (!value) return '';
  return normalizeSuggestionText(value.value);
}

/**
 * Strip markdown code fences (```json ... ```, ``` ... ```)
 * Many LLMs ignore "no markdown" instructions and wrap JSON in fences.
 */
function stripMarkdownFences(content: string): string {
  let cleaned = content
    // Remove opening ```json or ```JSON or ```
    .replace(/^```(?:json|JSON)?\s*\n?/gm, '')
    // Remove closing ```
    .replace(/\n?```\s*$/g, '')
    .trim();
  // Also handle case where entire content is wrapped in a single fence block
  const fenceMatch = cleaned.match(/^```(?:json|JSON)?\s*([\s\S]*?)\s*```\s*$/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  return cleaned;
}

/**
 * Strip single-line JavaScript-style comments (// ...)
 * Some models emit comments inside JSON-like output.
 */
function stripComments(json: string): string {
  return json.replace(/\/\/[^\n]*/g, '');
}

/**
 * Remove trailing commas before } or ] — common non-standard JSON from some LLMs.
 */
function removeTrailingCommas(json: string): string {
  return json.replace(/,\s*([}\]])/g, '$1');
}

/**
 * Find a balanced JSON object using brace-depth counting.
 * Unlike the greedy /\{[\s\S]*\}/ regex, this correctly handles:
 * - Text before/after the JSON object
 * - Nested objects and arrays inside strings
 * - Multiple { } pairs in the response text
 *
 * Returns the substring from the first { to its matching closing },
 * or null if no balanced object is found.
 */
function findBalancedBraces(content: string): string | null {
  const startIdx = content.indexOf('{');
  if (startIdx === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIdx; i < content.length; i++) {
    const ch = content[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue; // skip braces inside strings

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return content.slice(startIdx, i + 1);
      }
    }
  }

  return null; // unbalanced / truncated
}

/**
 * Attempt to recover a JSON object that was truncated mid-stream (e.g., max_tokens hit).
 *
 * When an LLM's output exceeds max_tokens, the JSON gets cut off partway through,
 * leaving unclosed strings, arrays, or objects. This function:
 * 1. Scans character-by-character tracking depth of {}, [], and string state
 * 2. Closes any open string with a quote
 * 3. Closes open arrays with ]
 * 4. Closes open objects with }
 * 5. Removes trailing commas before closing brackets
 *
 * Returns the recovered JSON string, or null if recovery is not possible.
 */
function attemptTruncatedJsonRecovery(content: string): string | null {
  // Start from the first { to avoid any preamble text
  const startIdx = content.indexOf('{');
  if (startIdx === -1) return null;

  const json = content.slice(startIdx);
  let depthObj = 0;
  let depthArr = 0;
  let inString = false;
  let escaped = false;
  let lastValidPos = 0;

  for (let i = 0; i < json.length; i++) {
    const ch = json[i];

    if (escaped) {
      escaped = false;
      lastValidPos = i + 1;
      continue;
    }

    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      if (!inString) lastValidPos = i + 1; // end of valid string
      continue;
    }

    if (inString) {
      lastValidPos = i + 1;
      continue; // skip everything inside strings
    }

    if (ch === '{') { depthObj++; lastValidPos = i + 1; }
    else if (ch === '}') { depthObj--; lastValidPos = i + 1; }
    else if (ch === '[') { depthArr++; lastValidPos = i + 1; }
    else if (ch === ']') { depthArr--; lastValidPos = i + 1; }
    else if (ch !== ' ' && ch !== '\n' && ch !== '\r' && ch !== '\t') {
      lastValidPos = i + 1;
    }
  }

  // If depth is 0, it's actually balanced — no truncation
  if (depthObj === 0 && depthArr === 0 && !inString) return null;

  // Truncation detected — build recovery suffix
  console.warn(`[VibePilot] Truncated JSON detected: objDepth=${depthObj}, arrDepth=${depthArr}, inString=${inString}, totalLen=${json.length}`);

  let recovered = json.slice(0, lastValidPos);

  // Close open string
  if (inString) recovered += '"';

  // Remove trailing comma if present (before we close brackets)
  recovered = recovered.replace(/,\s*$/g, '');

  // Close nested arrays first (innermost to outermost)
  for (let a = 0; a < depthArr; a++) recovered += ']';

  // Then close objects
  for (let o = 0; o < depthObj; o++) recovered += '}';

  console.log(`[VibePilot] Recovered JSON: original=${json.length} chars → recovered=${recovered.length} chars`);

  return recovered;
}

/**
 * Quick heuristic: does the content look like truncated JSON?
 * Returns a human-readable hint string or null if not truncation.
 */
function detectTruncationHint(content: string): string | null {
  const trimmed = content.trim();

  // Must start with { to be JSON
  if (!trimmed.startsWith('{')) return null;

  let depthObj = 0;
  let depthArr = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depthObj++;
    else if (ch === '}') depthObj--;
    else if (ch === '[') depthArr++;
    else if (ch === ']') depthArr--;
  }

  // If brackets are unbalanced, it's truncated
  if (depthObj > 0 || depthArr > 0 || inString) {
    const parts: string[] = [];
    if (inString) parts.push('字符串未闭合');
    if (depthArr > 0) parts.push(`${depthArr} 个数组未闭合`);
    if (depthObj > 0) parts.push(`${depthObj} 个对象未闭合（缺少 }）`);
    // Estimate how many more characters might be needed (rough heuristic)
    const missingChars = Math.max(depthObj * 20 + depthArr * 10 + (inString ? 5 : 0), 0);
    if (missingChars > 0) parts.push(`预计还需要约 ${missingChars}+ 字符完成输出`);

    return `检测到：${parts.join('，')}`;
  }

  return null;
}

/**
 * Multi-strategy JSON extraction & repair pipeline.
 *
 * Tries strategies in order of specificity/correctness:
 * 1. Direct JSON.parse (already clean)
 * 2. Strip markdown fences → parse
 * 3. Balanced brace extraction → strip fences → parse
 * 4. Strip comments + trailing commas + fences → parse
 * 5. Balanced braces + full repair (comments + commas)
 * 6. Greedy regex fallback with repair (original behavior, improved)
 *
 * Returns parsed object or null if all strategies fail.
 */
function tryRepairAndParse<T>(content: string): T | null {
  const attempts: Array<{ label: string; fn: () => T | null }> = [
    {
      label: 'direct parse',
      fn: () => { try { return JSON.parse(content) as T; } catch { return null; } },
    },
    {
      label: 'strip fences',
      fn: () => { try { return JSON.parse(stripMarkdownFences(content)) as T; } catch { return null; } },
    },
    {
      label: 'balanced braces + fences',
      fn: () => {
        const balanced = findBalancedBraces(content);
        if (!balanced) return null;
        try { return JSON.parse(stripMarkdownFences(balanced)) as T; } catch { return null; }
      },
    },
    {
      label: 'full repair (comments+commas+fences)',
      fn: () => {
        const repaired = removeTrailingCommas(stripComments(stripMarkdownFences(content)));
        try { return JSON.parse(repaired) as T; } catch { return null; }
      },
    },
    {
      label: 'balanced + full repair',
      fn: () => {
        const balanced = findBalancedBraces(content);
        if (!balanced) return null;
        const repaired = removeTrailingCommas(stripComments(stripMarkdownFences(balanced)));
        try { return JSON.parse(repaired) as T; } catch { return null; }
      },
    },
    {
      label: 'truncated recovery (close unclosed brackets)',
      fn: () => {
        const recovered = attemptTruncatedJsonRecovery(content);
        if (!recovered) return null;
        const cleaned = removeTrailingCommas(stripComments(stripMarkdownFences(recovered)));
        try { return JSON.parse(cleaned) as T; } catch { return null; }
      },
    },
    {
      label: 'balanced braces + truncated recovery',
      fn: () => {
        const balanced = findBalancedBraces(content);
        if (!balanced) return null;
        const recovered = attemptTruncatedJsonRecovery(balanced);
        if (!recovered) return null;
        const cleaned = removeTrailingCommas(stripComments(stripMarkdownFences(recovered)));
        try { return JSON.parse(cleaned) as T; } catch { return null; }
      },
    },
    {
      label: 'greedy regex + repair',
      fn: () => {
        const match = content.match(/\{[\s\S]*\}/);
        if (!match) return null;
        const cleaned = removeTrailingCommas(stripComments(stripMarkdownFences(match[0])));
        try { return JSON.parse(cleaned) as T; } catch { return null; }
      },
    },
  ];

  for (const attempt of attempts) {
    const result = attempt.fn();
    if (result !== null) {
      console.log(`[VibePilot] JSON extracted via: ${attempt.label}`);
      return result;
    }
  }

  return null;
}

export function extractJson<T>(content: string): T | null {
  const parsed = tryRepairAndParse<unknown>(content);
  return unwrapJsonPayload<T>(parsed);
}

/**
 * Unwrap common API wrapper patterns that models often produce:
 * - Array → first object
 * - { result: {...} } → unwrap
 * - { data: {...} } → unwrap
 * - { output: {...} } → unwrap
 * - { content: "{...}" } → parse string content
 * - { message: { content: "..." } } → parse string content
 * Max 2 recursion levels to avoid infinite loops.
 */
function unwrapJsonPayload<T>(parsed: unknown, depth = 0): T | null {
  if (parsed === null || parsed === undefined) return null;
  if (depth > 2) return null;

  // Array: take first element
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return null;
    const first = parsed[0];
    if (first && typeof first === 'object' && !Array.isArray(first)) {
      return first as T;
    }
    return null;
  }

  if (typeof parsed !== 'object') return null;

  const obj = parsed as Record<string, unknown>;

  // Check nested text content fields first (string that might be JSON)
  if (typeof obj.content === 'string') {
    const inner = extractJson<T>(obj.content);
    if (inner) return inner;
  }
  if (obj.message && typeof obj.message === 'object' && !Array.isArray(obj.message)) {
    const msg = obj.message as Record<string, unknown>;
    if (typeof msg.content === 'string') {
      const inner = extractJson<T>(msg.content);
      if (inner) return inner;
    }
  }

  // Check wrapper keys
  for (const key of ['result', 'data', 'output']) {
    const value = obj[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const unwrapped = unwrapJsonPayload<T>(value, depth + 1);
      if (unwrapped) return unwrapped;
    }
  }

  // It's already a plain object — return as-is
  return obj as T;
}

function hashString(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function readAICache(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(AI_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function writeAICache(cache: Record<string, unknown>): void {
  const entries = Object.entries(cache).slice(-50);
  localStorage.setItem(AI_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
}

function getAICacheKey(stage: string, brief: ProductBrief, model: string, systemPrompt: string, userContent: string): string {
  return `${stage}:${brief.id}:${model}:${hashString(systemPrompt)}:${hashString(userContent)}`;
}

export function clearAICache(): void {
  localStorage.removeItem(AI_CACHE_KEY);
}

function normalizeForReference(value: string): string {
  return value.toLowerCase().replace(/[\s"'“”‘’`.,，。;；:：!?！？()[\]{}【】<>《》/\\|-]/g, '');
}

function splitReferenceFragments(value: string): string[] {
  return value
    .split(/[\s"'“”‘’`.,，。;；:：!?！？()[\]{}【】<>《》/\\|-]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 4);
}

export interface AIReferenceValidationResult {
  passed: boolean;
  score: number;
  minRequired: number;
  referencedCount: number;
  matchedFields: string[];
  missingFields: string[];
  reason: string;
}

export function validateAIOutputReferencesInput(brief: ProductBrief, output: unknown): AIReferenceValidationResult {
  const outputRecord = output && typeof output === 'object' && !Array.isArray(output)
    ? output as Record<string, unknown>
    : null;

  // 1) Check referenceEvidence field (from updated prompts)
  const evidence = outputRecord?.referenceEvidence as Record<string, unknown> | undefined;
  const evidenceMatched: string[] = [];
  if (evidence && typeof evidence === 'object') {
    const evidenceEntries = [
      { key: 'rawIdea', label: 'rawIdea' },
      { key: 'targetUser', label: 'targetUser' },
      { key: 'scenario', label: 'scenario' },
      { key: 'problem', label: 'problem' },
      { key: 'projectType', label: 'projectType' },
    ];
    for (const { key, label } of evidenceEntries) {
      const val = evidence[key];
      if (val && typeof val === 'string' && val.length >= 2 && val !== '暂无' && val !== 'none') {
        evidenceMatched.push(label);
      }
    }
  }

  // 2) Full-text search on JSON output
  const outputText = normalizeForReference(JSON.stringify(output));
  const fieldWeights: Array<{ field: string; value: string; weight: number }> = [
    { field: 'rawIdea', value: brief.ideaInput.rawIdea || '', weight: 3 },
    { field: 'targetUser', value: brief.ideaInput.targetUser || '', weight: 2 },
    { field: 'scenario', value: brief.ideaInput.scenario || '', weight: 2 },
    { field: 'problem', value: brief.ideaInput.problem || '', weight: 2 },
    { field: 'projectType', value: brief.ideaInput.projectType || '', weight: 1 },
  ];

  // Filter valid fields
  const validFields = fieldWeights.filter((fw) => {
    const v = fw.value?.trim();
    if (!v) return false;
    const norm = normalizeForReference(v);
    return norm && norm.length >= 2; // allow short but meaningful fields
  });

  // 3) Check long-form content fields for keyword presence
  const contentFields = outputRecord ? [
    outputRecord.productBrief,
    outputRecord.mvpScope,
    outputRecord.devSpec,
    outputRecord.developmentPrompt,
    outputRecord.technicalArchitecture,
  ].filter((v): v is string => typeof v === 'string' && v.length > 10) : [];
  const contentText = normalizeForReference(contentFields.join(' '));

  let score = 0;
  let referencedCount = 0;
  const matchedFields: string[] = [];
  const missingFields: string[] = [];

  for (const fw of validFields) {
    const normalized = normalizeForReference(fw.value);
    const hitInJson = normalized && outputText.includes(normalized);
    const hitInContent = normalized && contentText.includes(normalized);
    const hitInFragments = splitReferenceFragments(fw.value).some(
      (fragment) => outputText.includes(normalizeForReference(fragment)) || contentText.includes(normalizeForReference(fragment)),
    );
    const hitInEvidence = evidenceMatched.includes(fw.field);

    if (hitInJson || hitInContent || hitInFragments || hitInEvidence) {
      referencedCount++;
      matchedFields.push(fw.field);
      score += fw.weight;
      // Bonus for evidence match
      if (hitInEvidence) score += 1;
      // Bonus for rawIdea content match
      if (fw.field === 'rawIdea' && hitInContent) score += 2;
    } else {
      missingFields.push(fw.field);
    }
  }

  // 4) If projectType is very short (like "Web App"), don't count it as missing for strict validation
  const shortProjectType = brief.ideaInput.projectType && normalizeForReference(brief.ideaInput.projectType).length < 6;

  // Calculate minimum required
  const numValidFields = validFields.length;
  const minRequired = numValidFields === 0 ? 0 : Math.min(2, numValidFields);

  const passed = (minRequired === 0) || (referencedCount >= minRequired && score >= 2);

  // Build reason
  let reason: string;
  if (passed) {
    reason = `命中 ${referencedCount}/${numValidFields} 字段（需要至少 ${minRequired}）: ${matchedFields.join(', ')}`;
  } else if (shortProjectType && numValidFields - referencedCount === 1 && missingFields.includes('projectType')) {
    reason = `仅 projectType 未命中（短字段放宽），命中 ${referencedCount}/${numValidFields} 字段: ${matchedFields.join(', ')}。可以接受。`;
    return { passed: true, score, minRequired, referencedCount, matchedFields, missingFields: [], reason };
  } else {
    reason = `仅命中 ${referencedCount}/${numValidFields} 字段（需要至少 ${minRequired}）: ${matchedFields.join(', ')}。未命中: ${missingFields.join(', ')}`;
  }

  return { passed, score, minRequired, referencedCount, matchedFields, missingFields, reason };
}

function assertAIOutputReferencesInput(brief: ProductBrief, output: unknown): void {
  const result = validateAIOutputReferencesInput(brief, output);
  if (!result.passed) {
    throw new VibeAIError(
      'validation',
      `AI 输出相关性不足：${result.reason}`,
      { detail: result },
    );
  }
}

export async function callCopilotJson<T>(systemPrompt: string, userContent: string, maxTokens = 1600, timeoutMs = DEFAULT_AI_TIMEOUT_MS): Promise<T> {
  const config = requireAIConfig();
  try {
    const data = await callAIProxy(config, {
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.2,
      max_tokens: maxTokens,
    }, timeoutMs);
    const content = extractAIContent(data);
    if (!content) {
      throw new VibeAIError('empty', '模型返回为空');
    }
    console.log('[VibePilot] Raw AI content (first 300 chars):', content.slice(0, 300));
    const json = extractJson<T>(content);
    if (!json) {
      // Log diagnostic info for debugging
      console.error('[VibePilot] JSON extraction failed. Raw content:', content.slice(0, 500));
      console.error('[VibePilot] Content length:', content.length);
      console.error('[VibePilot] Contains brace:', content.includes('{'));
      console.error('[VibePilot] Contains fence:', content.includes('```'));

      // Detect truncation — if content starts with valid JSON but is cut short
      const truncatedHint = detectTruncationHint(content);

      // Enhanced diagnostics
      const hasFence = content.includes('\x60\x60\x60');
      const hasPreamble = /^(以下是|好的|Here|Sure|OK|当然|没问题)/i.test(content.trim());
      const hasBrace = content.includes('{');
      const hasBracket = content.includes('[');
      const braceCount = (content.match(/\{/g) || []).length;
      const closeCount = (content.match(/\}/g) || []).length;

      const diag = [
        `len=${content.length}`,
        hasBrace ? `brace=${braceCount}/${closeCount}` : null,
        hasBracket ? 'hasArray' : null,
        hasFence ? 'hasFence' : null,
        hasPreamble ? 'hasPreamble' : null,
      ].filter(Boolean).join(', ');

      const diagHint = [
        hasPreamble ? '模型可能有解释文字前缀' : '',
        hasFence ? '模型用了 markdown 代码块' : '',
        hasBrace && braceCount !== closeCount ? `花括号不匹配（${braceCount}开 ${closeCount}闭）` : '',
        hasBracket && !hasBrace ? '模型返回了数组而非对象' : '',
        !hasBrace ? '模型未返回花括号' : '',
      ].filter(Boolean).join('；');

      const errorMsg = truncatedHint
        ? `模型输出被截断（可能 max_tokens 不足）。${truncatedHint}。原始返回：${content.slice(0, 200)}`
        : diagHint
          ? `模型返回不是有效 JSON（${diag}）。${diagHint}。原始返回：${content.slice(0, 200)}`
          : `模型返回格式错误，未找到有效 JSON（${diag}）。原始返回：${content.slice(0, 200)}`;
      throw new VibeAIError('json_parse', errorMsg, { rawContent: content.slice(0, 500) });
    }
    return json;
  } catch (err) {
    // If already a VibeAIError, re-throw
    if (err instanceof VibeAIError) throw err;

    const message = getErrorMessage(err);

    if (isLikelyTimeout(err)) {
      throw new VibeAIError('timeout',
        `大模型响应超时：已等待 ${Math.round(timeoutMs / 1000)} 秒。请检查模型是否响应较慢，或在设置页换用更快模型。`,
        { cause: err }
      );
    }
    throw new VibeAIError('unknown', `大模型生成失败：${message}`, { cause: err });
  }
}

async function cachedCopilotJson<T>(
  stage: string,
  brief: ProductBrief,
  systemPrompt: string,
  userContent: string,
  maxTokens = 900,
  timeoutMs = DEFAULT_AI_TIMEOUT_MS
): Promise<T> {
  const config = requireAIConfig();
  const cacheKey = getAICacheKey(stage, brief, config.model, systemPrompt, userContent);
  const cache = readAICache();
  if (cache[cacheKey]) {
    console.log('[VibePilot] AI Cache Hit:', { stage, briefId: brief.id, model: config.model });
    return cache[cacheKey] as T;
  }

  try {
    const result = await callCopilotJson<T>(systemPrompt, userContent, maxTokens, timeoutMs);
    cache[cacheKey] = result;
    writeAICache(cache);
    return result;
  } catch (err) {
    // JSON retry for non-MVP stages: stricter prompt, one retry
    if (err instanceof VibeAIError && err.type === 'json_parse' && !stage.startsWith('stage:mvp')) {
      console.warn('[VibePilot] JSON parse failed, retrying with stricter prompt...');
      const retryPrompt = `${systemPrompt}\n\n【紧急】上一次输出不是有效 JSON，无法被程序解析。本次必须只返回一个可直接被 JSON.parse 解析的对象。不要 markdown，不要解释文字，不要省略号，不要使用 result/data/output 包裹字段。`;
      try {
        const result = await callCopilotJson<T>(retryPrompt, userContent, Math.floor(maxTokens * 0.8), timeoutMs);
        cache[cacheKey] = result;
        writeAICache(cache);
        console.log('[VibePilot] JSON retry succeeded');
        return result;
      } catch (retryErr) {
        console.error('[VibePilot] JSON retry also failed:', retryErr);
      }
    }
    // MVP stages handle fallback in suggestStage; non-MVP re-throw
    throw err;
  }
}

export function detectScopeCreep(input: string): string[] {
  return SCOPE_CREEP_TERMS.filter((term) => input.toLowerCase().includes(term.toLowerCase()));
}

export async function evaluateIdea(input: IdeaInputState): Promise<EvaluateIdeaResult> {
  const missingFields: string[] = [];
  if (!input.targetUser) missingFields.push('目标用户');
  if (!input.scenario) missingFields.push('使用场景');
  if (!input.problem) missingFields.push('核心问题');
  if (!input.projectType) missingFields.push('产品形态');

  const riskFlags = detectScopeCreep([input.rawIdea, input.problem, input.scenario].filter(Boolean).join(' '));
  const score = Math.max(20, 90 - missingFields.length * 12 - riskFlags.length * 6);

  return {
    score,
    mainIssue: missingFields.length
      ? `信息还不完整：${missingFields.join('、')} 可以先由 AI 做默认假设。`
      : '输入已经具备基本方向，可以进入 AI 辅助构思。',
    missingFields,
    riskFlags,
    source: 'ai',
  };
}

function mockDemandDiscoverySuggestions(brief: ProductBrief): DemandDiscoveryState {
  const targetUser = brief.ideaInput.targetUser || '准备使用 AI 编程工具做第一个产品的新手';
  const scenario = brief.ideaInput.scenario || '准备把一个模糊想法交给 Cursor / Claude Code / Codex 开发前';
  const problem = brief.ideaInput.problem || '不知道这个需求是否真实，也不知道如何验证';
  return {
    targetUserEvidence: makeSuggestion(`${targetUser} 可能真的有这个问题，因为他们在 ${scenario} 时，通常缺少产品、业务、技术三方面的判断框架。`, '需求洞察先判断“谁真的痛”，避免只因为自己觉得酷就开工。'),
    painFrequency: makeSuggestion('中频偏高：每当用户准备启动一个新 vibe coding 项目时都会遇到，尤其是第一个项目和复杂 AI 工具项目。', '频率越高，用户越可能愿意使用专门工具。'),
    currentAlternative: makeSuggestion('当前替代方案通常是直接问 ChatGPT、自己写 PRD、参考竞品页面，或者直接让 AI 编程工具开写。', '替代方案说明用户并非没有办法，本产品必须比替代方案更结构化。'),
    consequenceIfUnsolved: makeSuggestion(`如果不解决，用户容易在“${problem}”上反复返工，最终写出页面但产品逻辑不成立。`, '后果越明确，需求越值得验证。'),
    demandEvidence: makeSuggestion(['用户会主动搜索 prompt 模板、PRD 模板、vibe coding 教程', '新手常在开发后才发现目标用户和 MVP 不清楚', 'AI 编程工具输出质量高度依赖前置需求质量'], '这些是需求可能成立的弱证据，后续需要访谈或行为数据验证。'),
    falsificationEvidence: makeSuggestion(['用户宁愿直接和通用大模型对话，不愿进入结构化流程', '用户觉得前期构思太慢，完成率很低', '生成的 Development Prompt 没有明显提升开发结果'], '提前写反证，能防止自嗨。'),
    smallestValidationAction: makeSuggestion('找 5 个准备做 AI 产品的新手，让他们分别用“直接问 ChatGPT”和“使用 VibePilot 流程”生成开发 Prompt，对比完成率、清晰度和复制意愿。', '最小验证动作应该低成本、可观察，而不是先开发完整系统。'),
  };
}

function mockProductSuggestions(brief: ProductBrief): ProductFramingState {
  const idea = brief.ideaInput.rawIdea || '这个产品想法';
  const targetUser = brief.ideaInput.targetUser || '准备使用 AI 编程工具做第一个产品的个人开发者或产品新手';
  const scenario = brief.ideaInput.scenario || '用户有一个模糊产品想法，准备交给 Codex / Claude Code / Cursor 开发前，需要先想清楚需求和边界';
  const problem = brief.ideaInput.problem || '用户知道想做什么，但缺少产品、业务和技术拆解能力，容易把第一版做成大而全的问卷或平台';
  return {
    productOneLiner: makeSuggestion(
      `面向${targetUser}的 AI 产品构思 Copilot，帮助他们在 ${scenario} 时，把“${idea}”收敛成可开发的 V1 方案。`,
      '先用一句话固定用户、场景、任务和结果，避免后续功能发散。',
      ['如果目标用户过宽，后续 MVP 会失焦。'],
      ['先做纯前端构思工具', '先做对话式 Agent']
    ),
    targetUser: makeSuggestion(targetUser, '目标用户越具体，技术和范围判断越容易落地。'),
    scenario: makeSuggestion(scenario, '场景决定用户在哪一步最需要帮助，也决定页面流程。'),
    corePainPoint: makeSuggestion(problem, '痛点绑定到具体任务，而不是泛泛的“效率低”。'),
    alternatives: makeSuggestion(['直接问 ChatGPT', '自己写 PRD', '照着竞品做页面', '直接让 Cursor 开始写代码'], '替代方案说明用户并非没有选择，本产品必须提供更结构化的前期思考价值。'),
    aiValue: makeSuggestion('AI 介入在“补全用户不知道的专业判断”环节：根据用户输入推断产品定义、业务假设、技术架构、数据结构和验收标准。', '这比单纯评价答案更接近 Copilot：AI 主动生成草案，用户负责确认和修正。'),
  };
}

function mockBusinessSuggestions(brief: ProductBrief): BusinessFramingState {
  const product = acceptedText(brief.stages.product.productOneLiner) || brief.ideaInput.rawIdea;
  return {
    userValue: makeSuggestion(`用户可以把模糊想法快速变成结构化开发前说明，减少反复返工和无效编码。`, `围绕“${product}”的核心价值应是降低前期构思成本，而不是堆功能。`),
    ownerValue: makeSuggestion('产品所有者可以验证新手是否愿意在写代码前使用结构化构思工具，并沉淀可复用模板。', 'V1 先验证使用意愿和交付质量，不急于商业化。'),
    valueHypothesis: makeSuggestion('如果 AI 生成的技术规划和 Development Prompt 足够具体，用户会更愿意先完成构思再开始 vibe coding。', '这是本产品最关键的可验证假设。'),
    metrics: makeSuggestion(['完成一次构思流程的比例', '用户接受 AI 建议的比例', '最终复制 Development Prompt 的次数', '用户返回修改建议的次数'], '指标围绕核心闭环，而不是泛泛统计访问量。'),
    monetization: makeSuggestion('V1 不优先商业化；后续可基于高级模板、项目历史、多模型优化和团队协作收费。', '商业化需要建立在用户反复使用和产出质量稳定之后。'),
    risksAndBlindSpots: makeSuggestion(['用户可能仍然想跳过思考直接写代码', 'AI 建议如果太泛会变成另一个问卷', '技术规划需要避免过度工程化'], '业务风险主要来自行为习惯和输出质量。'),
    roi: {
      userBenefitScore: makeSuggestion(4, '用户能减少前期返工，收益比较明确。'),
      ownerBenefitScore: makeSuggestion(4, '产品能沉淀一套可复用的新手构思流程。'),
      developmentCostScore: makeSuggestion(2, 'V1 可以纯前端 + localStorage + AI proxy，不需要复杂后端。'),
      maintenanceCostScore: makeSuggestion(2, '主要维护 prompt、AI 调用状态和页面流程，成本可控。'),
      aiCostRisk: makeSuggestion('中等：如果每页都调用大模型，成本会随使用次数增长；V1 必须显式提示 API 失败，不能用 mock 冒充 AI 输出。', 'AI 成本是这个产品的主要可变成本。'),
      userSwitchingCost: makeSuggestion('低到中：用户不用迁移数据，只需要愿意在开发前多走一遍结构化流程。', '切换成本越低，越适合做 MVP 验证。'),
      roiJudgement: makeSuggestion('positive', '收益清晰、开发成本较低，适合先做 MVP 验证。'),
      reason: makeSuggestion('用户收益主要来自少返工和更清晰的 Development Prompt；技术实现可控，所以 ROI 初步偏正向。', '这里是新手版 ROI，不做复杂财务模型。'),
    },
  };
}

function mockTechnicalSuggestions(brief?: ProductBrief): TechnicalPlanningState {
  const targetUser = brief?.ideaInput.targetUser || '用户';
  return {
    frontend: makeSuggestion('V1 推荐单页 Web App，使用 React + Vite + TypeScript + CSS/Tailwind。', '构思流程适合表单、卡片、阶段导航和本地状态，SPA 足够验证闭环。', ['页面状态较多，需要做好数据归一化。'], ['Next.js 多页面应用', '纯对话式 Agent 界面']),
    backend: makeSuggestion('V1 本身不需要业务后端；只需要一个同源 AI Proxy 用于隐藏 API 调用和规避 CORS。', '用户配置自己的 API，但浏览器不应直接请求第三方接口。', ['代理需要部署平台支持 serverless function。'], ['完全本地 mock', 'Supabase Edge Function']),
    database: makeSuggestion('V1 暂不需要数据库，使用 localStorage 保存项目历史和用户配置。', '当前主要验证生成流程，不需要跨设备账号和团队协作。', ['浏览器清缓存会丢失数据。'], ['静态 JSON', 'IndexedDB', 'Supabase / PostgreSQL']),
    aiApi: makeSuggestion('需要 AI API，但应由同源 /api/ai-proxy 转发；前端只保存用户配置并调用本项目代理。', 'API key 直接暴露给第三方跨域请求不稳定，也容易遇到 CORS。', ['用户仍需信任本地/部署环境。'], ['后端环境变量统一配置', '完全离线 mock']),
    auth: makeSuggestion('V1 不需要认证。', '单用户本地构思工具先降低使用门槛，账号系统会显著增加范围。', ['无法跨设备同步。'], ['后续接 Supabase Auth', '邮箱 magic link']),
    fileUpload: makeSuggestion('V1 不需要文件上传。', '当前输入主要是文字想法和用户确认，不需要处理文件内容。', ['无法直接读取 PRD 或截图。'], ['V2 支持上传 PRD/截图辅助分析']),
    dataFlow: makeSuggestion('输入 rawIdea → AI 生成 Product/Business/Technical/MVP 建议 → 用户接受或编辑 → Optimize 生成 Final Handoff → 复制/下载 Development Prompt。', '这个流转让 AI 承担专业补全，用户承担确认。'),
    mockStrategy: makeSuggestion('Mock 策略 = 先用假数据或假 AI 返回结果，模拟真实功能。它的作用是先验证产品流程，不要一开始就接复杂 API 或数据库。', 'V1 演示不应被模型配置阻塞。'),
    mockableParts: makeSuggestion(['AI 阶段建议', '输入诊断评分', '最终 Developer Handoff', '历史项目示例'], '这些部分都可以先用固定 JSON 模拟，保证流程可演示。'),
    mockDataExample: makeSuggestion('{ "value": "V1 使用 localStorage 保存历史项目", "reason": "先验证个人本地使用", "risks": ["清缓存会丢失"] }', 'mock 数据要接近真实 API 返回结构，后续替换更容易。'),
    realApiTrigger: makeSuggestion('当用户需要真实、多样、上下文相关的建议，并且 mock 输出无法覆盖不同项目时，再换真实 AI API。', '先验证流程，再增加模型成本。'),
    mockFailureFallback: makeSuggestion('如果 mock 或 AI 失败，用户应看到可编辑的默认建议和“重新生成”按钮，而不是白屏。', '失败状态也是新手友好体验的一部分。'),
    architectureUpgrade: makeSuggestion('当需要跨设备历史、账号、团队协作、文件上传或付费时，再升级到 Supabase/PostgreSQL + Auth + Storage。', '把升级条件写清楚，可以防止 V1 过度工程化。'),
    translations: [
      {
        userNeed: `${targetUser} 需要保存历史项目`,
        requiredCapability: '数据持久化',
        v1Implementation: 'localStorage',
        whyThisIsEnough: 'V1 只验证个人本地使用，不需要跨设备同步。',
        upgradeCondition: '当用户需要账号、跨设备同步、多项目管理时，再接 Supabase。',
        risks: ['清理浏览器缓存会丢失历史项目'],
      },
      {
        userNeed: '用户需要 AI 生成产品和技术建议',
        requiredCapability: '大模型调用',
        v1Implementation: '用户自定义 API + /api/ai-proxy + 显式连接状态',
        whyThisIsEnough: '支持真实模型调用，并在未连接成功时停止生成、提示修复配置。',
        upgradeCondition: '当需要统一计费、限流和审计时，再改成后端托管 API key。',
        risks: ['不同模型响应格式可能不一致'],
      },
      {
        userNeed: '用户需要理解技术词是什么意思',
        requiredCapability: '新手解释层',
        v1Implementation: '本地 glossary.ts + 这是什么入口',
        whyThisIsEnough: '术语解释是稳定内容，不需要每次调用 AI。',
        upgradeCondition: '当解释需要结合用户项目个性化展开时，再接 AI explain。',
      },
    ],
  };
}

/**
 * Build local-rule MVP scope draft when AI is unavailable or times out.
 * Always marked source='local-rule' to avoid pretending to be AI output.
 */
export function buildLocalMvpSuggestions(brief: ProductBrief): MvpScopeState {
  const productType = brief.ideaInput.projectType || '工具';
  const rawIdea = brief.ideaInput.rawIdea || '产品想法';

  const timeoutReason = 'AI 生成超时或未连接，当前为本地规则草案，可继续编辑或稍后重新生成。';

  const mustHaveItems = [
    '用户可以输入或编辑核心想法',
    '系统生成/保存关键结构化结果',
    '用户可以复制或下载最终开发交付文档',
  ];
  if (productType.includes('管理') || productType.includes('track')) {
    mustHaveItems.push('核心数据管理（增删改查）');
  } else if (productType.includes('生成') || productType.includes('分析')) {
    mustHaveItems.push('AI 生成/分析核心结果');
  } else {
    mustHaveItems.push(`完成${productType}的核心功能闭环`);
  }

  return {
    mustHave: {
      value: mustHaveItems.slice(0, 4),
      reason: timeoutReason,
      risks: ['如果 V1 缺少具体闭环功能，演示价值会偏低'],
      alternatives: ['精简为 2 条核心功能先跑通', '加入导出或分享功能快速收反馈'],
      accepted: false,
      editedByUser: false,
      source: 'ai',
    },
    shouldHave: {
      value: ['历史记录查看', '重新生成 AI 建议', 'Markdown 文件下载'],
      reason: timeoutReason,
      risks: [],
      alternatives: [],
      accepted: false,
      editedByUser: false,
      source: 'ai',
    },
    outOfScope: {
      value: ['登录/注册', '支付系统', '团队协作', '复杂后台', '向量数据库', 'MCP Server', '自动部署流水线'],
      reason: timeoutReason,
      risks: [],
      alternatives: [],
      accepted: false,
      editedByUser: false,
      source: 'ai',
    },
    v2Later: {
      value: ['账号同步', '多项目空间', '文件上传', '多模型评测'],
      reason: timeoutReason,
      risks: [],
      alternatives: [],
      accepted: false,
      editedByUser: false,
      source: 'ai',
    },
    minimumLoop: {
      value: `用户输入“${rawIdea.slice(0, 50)}”，系统生成第一版核心范围，用户确认后得到可复制的开发交付说明。`,
      reason: timeoutReason,
      risks: ['如果核心闭环包含过多步骤，用户可能无法完成'],
      alternatives: ['将范围收敛到纯输入→AI分析→输出三步'],
      accepted: false,
      editedByUser: false,
      source: 'ai',
    },
    scopeRisks: {
      value: [
        '如果加入登录/支付/团队协作会拖慢 V1 验证',
        '如果目标用户不清晰，MVP 容易变成泛用工具',
        '如果缺少验收标准，AI Coding 可能输出玩具 Demo',
      ],
      reason: timeoutReason,
      risks: [],
      alternatives: [],
      accepted: false,
      editedByUser: false,
      source: 'ai',
    },
    scopeCreepWarning: '当前为本地规则草案，建议在 AI 可用时重新生成以获得针对你产品的具体建议。',
  };
}

/**
 * Annotate all suggestion reasons in an MVP draft with the fallback cause.
 * Returns a new object, doesn't mutate the original.
 */
export function annotateLocalFallbackReason(draft: MvpScopeState, reason: string): MvpScopeState {
  const annotate = (prefix: string) => `${prefix}。AI 生成失败原因：${reason}。当前为本地规则草案，可继续编辑或稍后重新生成。`;
  const keys = ['mustHave', 'shouldHave', 'outOfScope', 'v2Later', 'minimumLoop', 'scopeRisks'] as const;
  const result = { ...draft };
  for (const key of keys) {
    const suggestion = result[key];
    if (suggestion && typeof suggestion.reason === 'string') {
      (result as Record<string, unknown>)[key] = { ...suggestion, reason: annotate(suggestion.reason) };
    }
  }
  return result;
}

function mockMvpSuggestions(brief: ProductBrief): MvpScopeState {
  const allText = JSON.stringify(brief.ideaInput) + JSON.stringify(brief.stages.product);
  const creep = detectScopeCreep(allText);
  return {
    mustHave: makeSuggestion(['产品想法输入', '产品理解 AI 建议与编辑确认', '技术规划 AI 推荐', 'MVP 范围收敛', '最终 Development Prompt 生成与复制'], 'Must Have 只保留能完成“从想法到开发交付”的闭环。'),
    shouldHave: makeSuggestion(['历史记录', '重新生成建议', '解释推荐原因', 'Markdown 下载'], '这些提升可用性，但不应阻塞核心闭环。'),
    outOfScope: makeSuggestion(['团队协作', '支付系统', '复杂项目管理', '自动代码生成', '上线部署流水线'], '这些会把 V1 做成大平台，暂时排除。'),
    v2Later: makeSuggestion(['账号同步', '多项目空间', '上传 PRD/截图', '竞品对比模板', '多模型评分'], 'V2 再根据用户反馈选择。'),
    minimumLoop: makeSuggestion('用户输入一个模糊想法，AI 生成并解释关键产品/业务/技术/MVP 决策，用户确认后得到可复制的 Development Prompt。', '最小闭环必须能独立产生开发价值。'),
    scopeRisks: makeSuggestion(creep.length ? [`检测到范围膨胀词：${creep.join('、')}`, 'V1 建议压缩为一个核心闭环'] : ['当前范围可控，但仍需避免加入账号、团队和自动部署。'], '范围风险来自“想一次性做完整平台”的倾向。'),
    scopeCreepWarning: creep.length ? '当前想法有范围膨胀风险。V1 建议压缩为一个核心闭环。' : undefined,
  };
}

function mockBlindSpotSuggestions(): BlindSpotReviewState {
  return {
    demandRisk: makeSuggestion(['目标用户可能没有强烈到愿意完成完整流程的痛点', '用户可能只想直接和通用大模型聊天，不想使用结构化工具'], '需求风险要从反证角度看。'),
    businessRisk: makeSuggestion(['如果最终 Prompt 对开发结果提升不明显，用户不会复用', '如果流程太长，完成率可能偏低'], '业务风险来自收益感知和完成率。'),
    technicalRisk: makeSuggestion(['不同 AI API 返回格式不统一', 'localStorage 数据可能因浏览器清理而丢失', '技术翻译如果太抽象，新手仍然看不懂'], '技术风险要关注 V1 是否稳定可演示。'),
    scopeRisk: makeSuggestion(['模式、术语、需求洞察、ROI、盲点审查同时加入，页面可能过重', '如果继续加入团队协作或数据库，会偏离 V1'], '第一版仍要压缩信息密度。'),
    whatWouldProveWrong: makeSuggestion(['5 个目标用户中少于 2 个愿意走完整流程', '用户复制最终 Prompt 后仍无法让 AI 编程工具正确开发', '用户认为术语解释没有帮助，仍需要人工讲解'], '这些信号能证明当前方案需要调整。'),
    recommendedAdjustment: makeSuggestion(['Beginner Mode 默认展开关键术语，但不要强制读完', 'Review Mode 优先展示风险和反证', '最终 Prompt 保持结构化，避免营销化表达'], '调整建议要能直接影响下一轮产品设计。'),
  };
}

function normalizeSuggestionMap<T extends Record<string, AiSuggestion | undefined>>(
  fallback: T,
  aiValue: Partial<Record<keyof T, Partial<AiSuggestion>>> | null
): T {
  if (!aiValue) return ENABLE_MOCK_FALLBACK ? fallback : ({} as T);
  const output = {} as T;
  Object.keys(fallback).forEach((key) => {
    const k = key as keyof T;
    const incoming = aiValue[k];
    if (incoming?.value !== undefined) {
      output[k] = {
        value: normalizeSuggestionValue(incoming.value),
        reason: normalizeSuggestionText(incoming.reason) || '由 AI 基于当前输入生成。',
        risks: normalizeSuggestionList(incoming.risks),
        alternatives: normalizeSuggestionList(incoming.alternatives),
        accepted: Boolean(incoming.accepted),
        editedByUser: Boolean(incoming.editedByUser),
        source: 'ai',
      } as T[keyof T];
    }
  });
  return output;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeSuggestionValue(value: unknown): SuggestionValue {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeSuggestionText(item)).filter(Boolean);
  }

  if (isPlainRecord(value) && 'value' in value) {
    return normalizeSuggestionValue(value.value);
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
    return value;
  }

  return normalizeSuggestionText(value);
}

function normalizeSuggestionText(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((item) => normalizeSuggestionText(item)).filter(Boolean).join('；');
  if (isPlainRecord(value) && 'value' in value) return normalizeSuggestionText(value.value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeSuggestionList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeSuggestionText(item)).filter(Boolean).slice(0, 3);
}

function buildKnowledgeSummary(brief: ProductBrief): string {
  const retrieved = retrieveKnowledge({
    rawIdea: brief.ideaInput.rawIdea,
    projectType: brief.ideaInput.projectType,
    targetUser: brief.ideaInput.targetUser,
    scenario: brief.ideaInput.scenario,
    problem: brief.ideaInput.problem,
    maxDocs: 5,
  });
  const summaryItems = retrieved.items?.length
    ? retrieved.items
    : retrieved.docs.map((doc) => ({
      doc,
      score: 0,
      matchedTags: [],
      matchedAliases: [],
      matchedFields: [],
      reason: `兼容旧检索结果引用 ${doc.title}。`,
    }));

  return [
    retrieved.explanation,
    ...summaryItems.map((item) => [
      `### ${item.doc.title}`,
      `Type: ${item.doc.type}`,
      `Score: ${item.score}`,
      `Matched Tags: ${item.matchedTags.join(', ') || '-'}`,
      `Matched Aliases: ${item.matchedAliases.join(', ') || '-'}`,
      `Reason: ${item.reason}`,
      `Summary: ${item.doc.summary}`,
      item.doc.content,
    ].join('\n')),
  ].join('\n\n');
}

function getReferenceInfluence(docId: string, docType: string): { appliedTo: string[]; influence: string } {
  if (docId === 'case-ielts-reading-webapp') {
    return {
      appliedTo: ['MVP Scope', 'Data Model', 'Acceptance Criteria'],
      influence: '用于推导学习工具的记录-复盘闭环，并建议 V1 采用 localStorage 保存 VocabularyItem、WrongAnswerRecord 等本地数据。',
    };
  }
  if (docId === 'case-prompteval-lab') {
    return {
      appliedTo: ['MVP Scope', 'Data Model', 'Evaluation'],
      influence: '用于推导 PromptVersion、EvaluationRun、ScoreDimension 等数据结构，并强调版本对比和评分标准。',
    };
  }
  if (docId === 'case-ai-customer-service-evaluation') {
    return {
      appliedTo: ['Evaluation', 'Acceptance Criteria', 'Prompt Rules'],
      influence: '用于推导客服回复评分维度、证据摘录和改写建议。',
    };
  }
  if (docId === 'case-vibe-copilot') {
    return {
      appliedTo: ['DEV_SPEC', 'Development Prompt', 'Technical Architecture'],
      influence: '用于强化从模糊想法到 Developer Handoff 的 AI Coding 前置规格链路。',
    };
  }
  return {
    appliedTo: docType === 'prompt-sample' ? ['Development Prompt', 'Verification'] : ['DEV_SPEC', 'Development Prompt'],
    influence: '用于补齐标准结构和交付格式。',
  };
}

function enhanceHandoffWithKnowledge(brief: ProductBrief, handoff: FinalHandoff): FinalHandoff {
  const retrieved = retrieveKnowledge({
    rawIdea: brief.ideaInput.rawIdea,
    projectType: brief.ideaInput.projectType,
    targetUser: brief.ideaInput.targetUser,
    scenario: brief.ideaInput.scenario,
    problem: brief.ideaInput.problem,
    maxDocs: 5,
  });
  const retrievalItems = retrieved.items?.length
    ? retrieved.items
    : retrieved.docs.map((doc) => ({
      doc,
      score: 0,
      matchedTags: [],
      matchedAliases: [],
      matchedFields: [],
      reason: `兼容旧检索结果引用 ${doc.title}。`,
    }));
  const knowledgeSummary = [
    retrieved.explanation,
    ...retrievalItems.map((item) => `- ${item.doc.title} (${item.doc.type}, score ${item.score}): ${item.reason}`),
  ].join('\n');
  const knowledgeReferences = retrievalItems.map((item) => {
    const influence = getReferenceInfluence(item.doc.id, item.doc.type);
    return {
      id: item.doc.id,
      title: item.doc.title,
      type: item.doc.type,
      score: item.score,
      matchedTags: item.matchedTags,
      matchedAliases: item.matchedAliases,
      matchedFields: item.matchedFields,
      reason: item.reason,
      appliedTo: influence.appliedTo,
      influence: influence.influence,
    };
  });
  const normalizedOriginalPrompt = normalizeSuggestionText(handoff.developmentPrompt);
  const baseForSpec = {
    productBrief: normalizeSuggestionText(handoff.productBrief),
    mvpScope: normalizeSuggestionText(handoff.mvpScope),
    technicalArchitecture: normalizeSuggestionText(handoff.technicalArchitecture),
    dataStructure: normalizeSuggestionText(handoff.dataStructure),
    acceptanceCriteria: normalizeSuggestionText(handoff.acceptanceCriteria),
    developmentPrompt: normalizedOriginalPrompt,
  };
  const structuredSpec = buildStructuredDevSpec({
    brief,
    ...baseForSpec,
    knowledgeReferences,
  });
  const structuredSpecMarkdown = formatStructuredDevSpecMarkdown(structuredSpec);
  const existingDevSpec = normalizeSuggestionText(handoff.devSpec);
  const devSpec = existingDevSpec
    ? existingDevSpec.includes('Structured DEV_SPEC Supplement')
      ? existingDevSpec
      : `${existingDevSpec}\n\n---\n\n## Structured DEV_SPEC Supplement\n\n${structuredSpecMarkdown}`
    : structuredSpecMarkdown || buildDevSpec({ ...baseForSpec, knowledgeSummary });
  const codexExecutionPrompt = buildKnowledgeEnhancedCodexPrompt({
    devSpec,
    constraints: [
      'Preserve the existing project flow.',
      'Do not add database, auth, payment, team collaboration, vector database, embeddings, rerank, or MCP server.',
      'Keep the current UI style and CSS variables.',
      'All object values must be formatted before rendering in React.',
    ],
    testCommand: 'npm run build',
  });
  const developmentPrompt = normalizedOriginalPrompt.includes('Codex Execution Wrapper')
    ? normalizedOriginalPrompt
    : `${normalizedOriginalPrompt}\n\n---\n\n## Codex Execution Wrapper\n\n${codexExecutionPrompt}`.trim();
  const withDevSpec: FinalHandoff = {
    ...handoff,
    schemaVersion: 'v1.4',
    ...baseForSpec,
    devSpec,
    developmentPrompt,
    knowledgeReferences,
  };

  return {
    ...withDevSpec,
    evaluation: handoff.evaluation || evaluateHandoff(withDevSpec),
  };
}

function normalizeBusinessSuggestions(
  fallback: BusinessFramingState,
  aiValue: Partial<Record<string, Partial<AiSuggestion> | Partial<BusinessRoi>>> | null
): BusinessFramingState {
  const base = normalizeSuggestionMap(
    fallback as Record<string, AiSuggestion | undefined>,
    aiValue as Partial<Record<string, Partial<AiSuggestion>>> | null
  ) as BusinessFramingState;
  const incomingRoi = aiValue?.roi as Partial<BusinessRoi> | undefined;
  if (!incomingRoi) return base;

  return {
    ...base,
    roi: normalizeSuggestionMap(
      (fallback.roi || {}) as Record<string, AiSuggestion | undefined>,
      incomingRoi as Partial<Record<string, Partial<AiSuggestion>>>
    ) as BusinessRoi,
  };
}

/** Stage-specific token budgets based on typical output size */
const STAGE_TOKEN_BUDGET: Record<FramingStage, number> = {
  discovery: 900,    // ~5 fields, moderate output
  product: 1000,     // ~6 fields with longer values
  business: 1200,    // ~7 fields + ROI sub-object
  technical: 2400,   // ~15+ fields (architecture, frontend, backend, database, aiApi, auth,
                      //   fileUpload, mockStrategy, mockableParts, mockDataExample,
                      //   realApiTrigger, mockFailureFallback, dataFlow, translations[], architectureUpgrade)
  mvp: 1400,         // ~7-9 fields including scope analysis
  blindSpot: 1300,   // ~9 fields with detailed risk descriptions
};

export async function suggestStage(stage: 'discovery', brief: ProductBrief): Promise<DemandDiscoveryState>;
export async function suggestStage(stage: 'product', brief: ProductBrief): Promise<ProductFramingState>;
export async function suggestStage(stage: 'business', brief: ProductBrief): Promise<BusinessFramingState>;
export async function suggestStage(stage: 'technical', brief: ProductBrief): Promise<TechnicalPlanningState>;
export async function suggestStage(stage: 'mvp', brief: ProductBrief): Promise<MvpScopeState>;
export async function suggestStage(stage: 'blindSpot', brief: ProductBrief): Promise<BlindSpotReviewState>;

export async function suggestStage(stage: FramingStage, brief: ProductBrief): Promise<Partial<CopilotStages[FramingStage]>> {
  requireAIReady();
  const fallback = stage === 'discovery'
    ? mockDemandDiscoverySuggestions(brief)
    : stage === 'product'
      ? mockProductSuggestions(brief)
      : stage === 'business'
        ? mockBusinessSuggestions(brief)
        : stage === 'technical'
          ? mockTechnicalSuggestions(brief)
          : stage === 'blindSpot'
            ? mockBlindSpotSuggestions()
            : mockMvpSuggestions(brief);

  // --- MVP fast path: lightweight context + prompt + shorter timeout ---
  if (stage === 'mvp') {
    const context = buildCompactStageContext('mvp', brief);
    const cacheStage = 'stage:mvp:fast';
    console.log('[VibePilot] MVP fast request:', {
      contextChars: context.length,
      maxTokens: 900,
      timeoutMs: 75000,
    });

    try {
      const ai = await cachedCopilotJson<Record<string, unknown>>(
        cacheStage,
        brief,
        buildMvpScopePrompt(),
        context,
        900,
        75000,
      );
      const validation = validateAIOutputReferencesInput(brief, ai);
      if (!validation.passed) {
        const hasSchema = ai && typeof ai === 'object' && Object.keys(ai).length > 1;
        if (hasSchema) {
          console.warn('[VibePilot] MVP validation salvage:', validation.reason);
        } else {
          throw new VibeAIError('validation', `AI MVP 输出相关性不足：${validation.reason}`, { detail: validation });
        }
      }
      // Strip referenceEvidence + scopeCreepWarning before normalizing
      const aiWithoutMeta = { ...ai };
      delete aiWithoutMeta.referenceEvidence;
      const scopeCreepWarning = typeof ai.scopeCreepWarning === 'string' ? ai.scopeCreepWarning : undefined;
      delete aiWithoutMeta.scopeCreepWarning;
      const result = normalizeSuggestionMap(fallback as Record<string, AiSuggestion>, aiWithoutMeta as Record<string, Partial<AiSuggestion>>) as MvpScopeState;
      if (scopeCreepWarning) result.scopeCreepWarning = scopeCreepWarning;
      return result;
    } catch (error) {
      // V4.4: No local-rule fallback. Throw all errors so the page can handle them.
      console.error('[VibePilot] MVP AI request failed:', error);
      throw error;
    }
  }

  // --- Original path for non-mvp stages ---
  try {
    const context = buildBriefContext(brief);
    const stageMaxTokens = STAGE_TOKEN_BUDGET[stage] || 1600;
    const ai = await cachedCopilotJson<Record<string, Partial<AiSuggestion>>>(
      `stage:${stage}`,
      brief,
      buildSuggestStagePrompt(stage),
      context,
      stageMaxTokens,
      SUGGEST_AI_TIMEOUT_MS
    );
    const validation = validateAIOutputReferencesInput(brief, ai);
    if (!validation.passed) {
      const hasSchema = ai && typeof ai === 'object' && Object.keys(ai).length > 1;
      if (hasSchema) {
        console.warn(`[VibePilot] Validation salvage for stage ${stage}:`, validation.reason);
      } else {
        throw new VibeAIError('validation', `AI 输出相关性不足：${validation.reason}`, { detail: validation });
      }
    }
    if (stage === 'business') {
      return normalizeBusinessSuggestions(fallback as BusinessFramingState, ai) as Partial<CopilotStages[FramingStage]>;
    }
    return normalizeSuggestionMap(fallback as Record<string, AiSuggestion>, ai) as Partial<CopilotStages[FramingStage]>;
  } catch (error) {
    // V4.4: No local-rule or mock fallback. Throw all errors.
    console.error(`[VibePilot] Stage ${stage} failed:`, error);
    throw error;
  }
}

export async function suggestIdeaDiagnosis(brief: ProductBrief): Promise<{
  discovery: DemandDiscoveryState;
  product: ProductFramingState;
  business: BusinessFramingState;
}> {
  requireAIReady();
  const fallback = {
    discovery: mockDemandDiscoverySuggestions(brief),
    product: mockProductSuggestions(brief),
    business: mockBusinessSuggestions(brief),
  };

  try {
    const context = buildBriefContext(brief);
    const ai = await cachedCopilotJson<{
      discovery: Partial<Record<keyof DemandDiscoveryState, Partial<AiSuggestion>>>;
      product: Partial<Record<keyof ProductFramingState, Partial<AiSuggestion>>>;
      business: Partial<Record<string, Partial<AiSuggestion> | Partial<BusinessRoi>>>;
    }>(
      'ideaDiagnosis',
      brief,
      `你是产品前期构思 Copilot。基于用户输入一次性生成 Idea Diagnosis。
【重要】严格只返回一个 JSON 对象，不要用 markdown 代码块包裹（不要输出 \x60\x60\x60json 或 \x60\x60\x60），不要添加注释或任何多余文字。必须引用 rawIdea、targetUser、scenario、problem、projectType 中至少两个字段。
不要输出与用户想法无关的通用模板。
默认只生成核心决策摘要，不生成完整长文。

字段格式：每个建议字段都是 {"value": string|string[]|number, "reason": string, "risks": string[], "alternatives": string[]}。
返回结构：
{
  "discovery": {
    "targetUserEvidence": {}, "currentAlternative": {}, "smallestValidationAction": {}
  },
  "product": {
    "productOneLiner": {}, "targetUser": {}, "scenario": {}, "corePainPoint": {}, "aiValue": {}
  },
  "business": {
    "valueHypothesis": {}, "risksAndBlindSpots": {},
    "roi": {
      "roiJudgement": {}, "reason": {}
    }
  }
}
限制：value 不超过 70 字；reason 不超过 35 字；数组最多 2 条；roiJudgement.value 只能是 positive/uncertain/negative。`,
      context,
      2000,
      SUGGEST_AI_TIMEOUT_MS
    );
    const validation = validateAIOutputReferencesInput(brief, ai);
    if (!validation.passed) {
      // Salvage: if discovery/product/business schemas exist, accept with warning
      const hasSchema = ai && typeof ai === 'object' && (ai.discovery || ai.product || ai.business);
      if (hasSchema) {
        console.warn('[VibePilot] IdeaDiagnosis validation salvage:', validation.reason);
      } else {
        throw new VibeAIError('validation', `AI 输出相关性不足：${validation.reason}`, { detail: validation });
      }
    }
    return {
      discovery: normalizeSuggestionMap(fallback.discovery as Record<string, AiSuggestion>, ai.discovery || null) as DemandDiscoveryState,
      product: normalizeSuggestionMap(fallback.product as Record<string, AiSuggestion>, ai.product || null) as ProductFramingState,
      business: normalizeBusinessSuggestions(fallback.business, ai.business || null),
    };
  } catch (error) {
    if (!ENABLE_MOCK_FALLBACK) throw error;
    console.warn('[VibePilot] Idea diagnosis failed, explicit dev mock used:', error);
    return fallback;
  }
}

export async function explainSuggestion(section: string, brief: ProductBrief): Promise<string> {
  requireAIReady();
  const context = `要解释的项：${section}\n\n当前项目上下文：\n${buildBriefContext(brief)}`;
  const ai = await cachedCopilotJson<{ explanation: string }>(
    `explain:${section}`,
    brief,
    buildExplainSuggestionPrompt(),
    context,
    300,
    EXPLAIN_AI_TIMEOUT_MS
  );
  if (!ai.explanation) {
    throw new VibeAIError('empty', '模型返回为空');
  }
  assertAIOutputReferencesInput(brief, ai);
  return normalizeSuggestionText(ai.explanation);
}

export function buildLocalHandoff(brief: ProductBrief): FinalHandoff {
  const discovery = brief.stages.discovery;
  const product = brief.stages.product;
  const business = brief.stages.business;
  const technical = brief.stages.technical;
  const mvp = brief.stages.mvp;
  const blindSpot = brief.stages.blindSpot;
  const roi = business.roi;
  const translations = (technical.translations || [])
    .map((row) => `- ${row.userNeed} -> ${row.requiredCapability} -> ${row.v1Implementation} (${row.whyThisIsEnough}; 升级条件：${row.upgradeCondition})`)
    .join('\n');

  const productBrief = `产品定义：${acceptedText(product.productOneLiner) || brief.ideaInput.rawIdea}\n目标用户：${acceptedText(product.targetUser)}\n使用场景：${acceptedText(product.scenario)}\n核心痛点：${acceptedText(product.corePainPoint)}\n需求洞察：${acceptedText(discovery.targetUserEvidence)}\nAI 介入价值：${acceptedText(product.aiValue)}`;
  const mvpScope = `Must Have：${acceptedText(mvp.mustHave)}\nShould Have：${acceptedText(mvp.shouldHave)}\nOut of Scope：${acceptedText(mvp.outOfScope)}\n最小闭环：${acceptedText(mvp.minimumLoop)}\n范围风险：${acceptedText(mvp.scopeRisks)}`;
  const technicalArchitecture = `前端：${acceptedText(technical.frontend)}\n后端：${acceptedText(technical.backend)}\n数据库：${acceptedText(technical.database)}\nAI API：${acceptedText(technical.aiApi)}\n认证：${acceptedText(technical.auth)}\n文件上传：${acceptedText(technical.fileUpload)}\nMock 策略：${acceptedText(technical.mockStrategy)}\n技术翻译：\n${translations}\n架构升级条件：${acceptedText(technical.architectureUpgrade)}`;
  const dataStructure = `Core entities:\n- IdeaInput { rawIdea, targetUser?, scenario?, problem?, projectType? }\n- DemandDiscovery { targetUserEvidence, painFrequency, currentAlternative, demandEvidence, falsificationEvidence, smallestValidationAction }\n- AiSuggestion<T> { value, reason, risks, alternatives, accepted, editedByUser }\n- BusinessRoi { userBenefitScore, ownerBenefitScore, developmentCostScore, maintenanceCostScore, roiJudgement }\n- TechnicalTranslation { userNeed, requiredCapability, v1Implementation, whyThisIsEnough, upgradeCondition, risks }\n- BlindSpotReview { demandRisk, businessRisk, technicalRisk, scopeRisk, whatWouldProveWrong, recommendedAdjustment }\n- FinalHandoff { productBrief, mvpScope, technicalArchitecture, dataStructure, acceptanceCriteria, developmentPrompt }\n\n数据流：${acceptedText(technical.dataFlow)}`;
  const acceptanceCriteria = [
    '用户可以只填写 rawIdea，并选择 Beginner / Builder / Review 模式后进入流程。',
    'Demand Discovery 能输出需求成立证据、反证和最小验证动作。',
    'Business 页面能显示简化 ROI 判断，包括用户收益、开发成本、维护成本和结论。',
    'Technical 页面能展示“需求 -> 技术能力 -> V1 实现 -> 升级条件”的翻译表。',
    'Mock 策略有白话解释、mock 范围、mock 数据示例、换真实 API 条件和失败兜底。',
    'Scope 页面能识别范围膨胀，并明确 Must Have / Out of Scope。',
    'Blind Spot Review 能指出需求、业务、技术、范围风险和反证。',
    '最终 Development Prompt 包含 14 个指定部分。',
  ].join('\n');
  const developmentPrompt = `# Development Prompt\n\n## 1. 产品目标\n${acceptedText(product.productOneLiner) || brief.ideaInput.rawIdea}\n\n## 2. 目标用户\n${acceptedText(product.targetUser)}\n\n## 3. 需求洞察\n谁真的有问题：${acceptedText(discovery.targetUserEvidence)}\n问题频率：${acceptedText(discovery.painFrequency)}\n当前替代方案：${acceptedText(discovery.currentAlternative)}\n不解决后果：${acceptedText(discovery.consequenceIfUnsolved)}\n需求成立证据：${acceptedText(discovery.demandEvidence)}\n需求不成立证据：${acceptedText(discovery.falsificationEvidence)}\n最小验证动作：${acceptedText(discovery.smallestValidationAction)}\n\n## 4. 用户主流程\n1. 用户输入一个模糊产品想法。\n2. 系统生成需求洞察、产品定义、业务 ROI、技术翻译和 MVP 压缩建议。\n3. 用户接受或编辑建议。\n4. 系统进行盲点审查。\n5. 用户复制或下载最终开发交付文档。\n\n## 5. MVP 范围\n${mvpScope}\n\n## 6. 页面结构\n- Landing Page：首页与模式说明\n- Idea Input：输入原始想法和模式选择\n- Demand Discovery：需求洞察\n- Product Framing：产品定义\n- Business Reasoning：业务推理与 ROI\n- Technical Translation：技术翻译与 Mock 策略\n- MVP Compression：范围压缩\n- Blind Spot Review：盲点审查\n- Developer Handoff：最终交付\n\n## 7. 技术架构\n${technicalArchitecture}\n\n## 8. 数据结构\n${dataStructure}\n\n## 9. Mock 策略\n${acceptedText(technical.mockStrategy)}\n可 mock 部分：${acceptedText(technical.mockableParts)}\nmock 数据示例：${acceptedText(technical.mockDataExample)}\n换真实 API 条件：${acceptedText(technical.realApiTrigger)}\n失败兜底：${acceptedText(technical.mockFailureFallback)}\n\n## 10. AI API 规则\n- 用户自行配置 API URL / API Key / Model。\n- 前端调用同源 /api/ai-proxy，不直接跨域请求第三方模型。\n- AI 不可用时必须停止生成并提示用户检查 API 配置，不允许输出 mock 结果冒充 AI 分析。\n- 不要在代码中硬编码用户私有 API key。\n\n## 11. 验收标准\n${acceptanceCriteria}\n\n## 12. Out of Scope\n${acceptedText(mvp.outOfScope)}\n\n## 13. 风险与盲点\n需求风险：${acceptedText(blindSpot.demandRisk)}\n业务风险：${acceptedText(blindSpot.businessRisk)}\n技术风险：${acceptedText(blindSpot.technicalRisk)}\n范围风险：${acceptedText(blindSpot.scopeRisk)}\n反证：${acceptedText(blindSpot.whatWouldProveWrong)}\n推荐调整：${acceptedText(blindSpot.recommendedAdjustment)}\n\n## 14. 禁止事项\n- V1 不做登录、支付、数据库、团队协作、完整 SaaS 后台。\n- 不把第一版扩展成大平台。\n- 不把 AI 输出失败变成白屏。\n- 不生成只有营销语言、缺少页面结构和验收标准的开发说明。\n`;
  const roiSummary = `用户收益：${roi?.userBenefitScore?.value || '-'} / 5\n所有者收益：${roi?.ownerBenefitScore?.value || '-'} / 5\n开发成本：${roi?.developmentCostScore?.value || '-'} / 5\n维护成本：${roi?.maintenanceCostScore?.value || '-'} / 5\nROI 判断：${roi?.roiJudgement?.value || 'uncertain'}\n理由：${roi?.reason?.value || ''}`;
  return enhanceHandoffWithKnowledge(brief, {
    productBrief,
    mvpScope,
    devSpec: '',
    technicalArchitecture: `${technicalArchitecture}\n\n业务 ROI：\n${roiSummary}`,
    dataStructure,
    acceptanceCriteria,
    developmentPrompt,
    source: 'ai',
  });
}
export async function optimizeHandoff(brief: ProductBrief): Promise<FinalHandoff> {
  requireAIReady();

  try {
    const context = buildBriefContext(brief);
    const knowledgeSummary = buildKnowledgeSummary(brief);
    const ai = await cachedCopilotJson<Record<string, unknown>>(
      'handoff:optimize',
      brief,
      buildOptimizeHandoffPrompt(knowledgeSummary),
      `${context}\n\n## Retrieved Knowledge\n${knowledgeSummary}`,
      2400,
      HANDOFF_AI_TIMEOUT_MS
    );
    const validation = validateAIOutputReferencesInput(brief, ai);
    // Strip referenceEvidence from AI output before passing to enhancer
    const aiWithoutEvidence = { ...ai };
    delete aiWithoutEvidence.referenceEvidence;

    // Check if key fields exist
    const hasKeyFields = typeof ai.productBrief === 'string' && typeof ai.mvpScope === 'string'
      && typeof ai.devSpec === 'string' && typeof ai.developmentPrompt === 'string';

    if (!validation.passed) {
      if (hasKeyFields) {
        // Salvage: schema is valid but reference is weak
        console.warn('[VibePilot] Handoff validation salvage:', validation.reason);
        const result = enhanceHandoffWithKnowledge(brief, {
          productBrief: normalizeSuggestionText(ai.productBrief),
          mvpScope: normalizeSuggestionText(ai.mvpScope),
          devSpec: normalizeSuggestionText(ai.devSpec),
          technicalArchitecture: normalizeSuggestionText(ai.technicalArchitecture),
          dataStructure: normalizeSuggestionText(ai.dataStructure),
          acceptanceCriteria: normalizeSuggestionText(ai.acceptanceCriteria),
          developmentPrompt: normalizeSuggestionText(ai.developmentPrompt),
          source: 'ai',
        });
        result.validationWarnings = [validation.reason];
        return result;
      }
      throw new VibeAIError('validation', `AI Handoff 输出相关性不足：${validation.reason}`, { detail: validation });
    }

    return enhanceHandoffWithKnowledge(brief, {
      productBrief: normalizeSuggestionText(ai.productBrief),
      mvpScope: normalizeSuggestionText(ai.mvpScope),
      devSpec: normalizeSuggestionText(ai.devSpec),
      technicalArchitecture: normalizeSuggestionText(ai.technicalArchitecture),
      dataStructure: normalizeSuggestionText(ai.dataStructure),
      acceptanceCriteria: normalizeSuggestionText(ai.acceptanceCriteria),
      developmentPrompt: normalizeSuggestionText(ai.developmentPrompt),
      source: 'ai',
    });
  } catch (error) {
    // V4.4: No local-rule or mock fallback for handoff.
    console.error('[VibePilot] Handoff optimization failed:', error);
    throw error;
  }
}

// --- Public API ---

export async function evaluateStep(req: EvaluateRequest): Promise<EvaluateResponse> {
  const config = requireAIReady();
  const result = await callDirectAI(req, config);
  await new Promise((r) => setTimeout(r, 200));
  return result;
}

export async function getStepHint(step: StepConfig): Promise<string> {
  try {
    const config = requireAIReady();
    const hintSystemPrompt = buildSystemPrompt({
      step,
      userAnswer: '',
      rawIdea: '',
      allSteps: {},
      mode: 'hint',
    });

    const data = await callAIProxy(config, {
      model: config.model,
      messages: [
        { role: 'system', content: hintSystemPrompt },
        { role: 'user', content: '我不知道怎么回答这个问题，请给我一些提示方向。' },
      ],
      max_tokens: 200,
      temperature: 0.7,
    }, EXPLAIN_AI_TIMEOUT_MS);
    const content = extractAIContent(data);
    if (!content) {
      throw new VibeAIError('empty', '模型返回为空');
    }
    return content;
  } catch (err) {
    console.warn('AI hint failed, explicit dev mock used:', err);
  }

  await new Promise((r) => setTimeout(r, 400 + Math.random() * 300));
  const hints = STEP_HINTS[step.key];
  return hints ? getRandomItem(hints) : '试着想象一个具体的用户场景，然后把你看到的写下来。';
}

export async function askFollowUp(req: EvaluateRequest): Promise<string> {
  try {
    const config = requireAIReady();
    const result = await callDirectAI({ ...req, mode: 'followup' }, config);
    if (!result.followUp) throw new VibeAIError('empty', '模型返回为空');
    return result.followUp;
  } catch (err) {
    if (!ENABLE_MOCK_FALLBACK) throw err;
    console.warn('AI follow-up failed, explicit dev mock used:', err);
  }

  await new Promise((r) => setTimeout(r, 500 + Math.random() * 400));
  return '你可以从哪个角度继续深入思考？试着补充一个具体的数字或场景。';
}

export async function generateDevelopmentPrompt(
  rawIdea: string,
  steps: Record<string, StepData>
): Promise<string> {
  await new Promise((r) => setTimeout(r, 800));

  const getAnswer = (key: string) => steps[key]?.userAnswer || '';

  let prompt = `# Development Prompt\n\n`;
  prompt += `## 产品目标\n\n${rawIdea}\n\n---\n\n`;
  prompt += `## 目标用户\n\n${getAnswer('targetUser')}\n\n`;
  prompt += `## 使用场景与核心痛点\n\n`;
  prompt += `**场景**：${getAnswer('scenario')}\n\n`;
  prompt += `**痛点**：${getAnswer('painPoint')}\n\n`;
  prompt += `**现有替代方案**：${getAnswer('alternatives')}\n\n`;
  if (getAnswer('aiValue')) {
    prompt += `## AI 介入价值\n\n${getAnswer('aiValue')}\n\n---\n\n`;
  } else {
    prompt += `---\n\n`;
  }
  prompt += `## MVP 功能范围\n\n${getAnswer('mvpScope')}\n\n`;
  prompt += `## 暂不做的功能\n\n${getAnswer('outOfScope')}\n\n---\n\n`;
  prompt += `## 技术架构\n\n${getAnswer('techStack')}\n\n`;
  prompt += `## 数据结构\n\n${getAnswer('dataStructure')}\n\n---\n\n`;
  prompt += `## 验收标准\n\n${getAnswer('acceptanceCriteria')}\n\n`;
  prompt += `---\n\n*由 VibePilot 生成 — 基于用户自己的思考结果*\n`;
  return prompt;
}
