import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Brain,
  Settings,
  Check,
  Loader2,
  AlertTriangle,
  Trash2,
  Zap,
  Eye,
  EyeOff,
  ExternalLink,
  Home,
  Activity,
} from 'lucide-react';
import {
  clearAIConfig,
  clearAICache,
  extractAIContent,
  extractJson,
  getAIConfig,
  getAIConnectionStatus,
  normalizeApiUrl,
  saveAIConfig,
  saveAIConnectionStatus,
  validateAIOutputReferencesInput,
  type AIConnectionStatus,
} from '../api/evaluate';
import {
  clearApiHealth,
  getApiHealth,
  markApiFailed,
  markApiReady,
  markApiBasicReady,
  updateApiHealthTests,
  type ApiHealthStatus,
} from '../api/apiHealth';
import {
  getTimeoutProfile,
} from '../api/timeoutProfile';
import {
  getLastAITiming,
  type AITimingDiagnostic,
} from '../api/aiDiagnostics';
import { PageReveal, LiquidCard, LiquidBadge } from '../components/liquid';
import ThemeToggle from '../components/ThemeToggle';

const PRESETS = [
  {
    name: 'OpenAI',
    apiUrl: 'https://api.openai.com',
    model: 'gpt-4o',
    docUrl: 'https://platform.openai.com/api-keys',
  },
  {
    name: 'DeepSeek',
    apiUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    docUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    name: 'GLM (智谱)',
    apiUrl: 'https://open.bigmodel.cn/api/paas',
    model: 'glm-4-flash',
    docUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
  },
];

/** Minimal brief used for Settings long JSON test validation */
const LONG_TEST_BRIEF = {
  id: 'settings-test',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  rawIdea: '雅思生词和错题管理工具',
  mode: 'beginner' as const,
  ideaInput: {
    rawIdea: '雅思生词和错题管理工具',
    targetUser: '正在备考雅思、需要复盘阅读和听力错题的学生',
    scenario: '做完剑桥雅思真题后整理生词、同义替换和错题原因',
    problem: '生词、同义替换和错题原因分散记录，无法形成可复盘的词库和错题模式',
    projectType: 'Web App',
  },
  stages: {
    discovery: {} as Record<string, unknown>,
    product: {} as Record<string, unknown>,
    business: {} as Record<string, unknown>,
    technical: {} as Record<string, unknown>,
    mvp: {} as Record<string, unknown>,
    blindSpot: {} as Record<string, unknown>,
  },
  steps: {} as Record<string, unknown>,
  developmentPrompt: '',
} as unknown as import('../types').ProductBrief;

function isUsefulString(value: unknown, minLength = 10): value is string {
  return typeof value === 'string'
    && value.trim().length >= minLength
    && value.trim() !== '...'
    && value.trim() !== '待补充'
    && value.trim() !== 'N/A';
}

interface TestResult {
  status: 'idle' | 'running' | 'pass' | 'fail';
  durationMs?: number;
  error?: string;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<AIConnectionStatus>(getAIConnectionStatus());
  const [lastTiming, setLastTiming] = useState<AITimingDiagnostic | null>(getLastAITiming());

  // V4.9: Layered test results
  const [quickPing, setQuickPing] = useState<TestResult>({ status: 'idle' });
  const [jsonTest, setJsonTest] = useState<TestResult>({ status: 'idle' });
  const [longJson, setLongJson] = useState<TestResult>({ status: 'idle' });
  const [refValidation, setRefValidation] = useState<TestResult>({ status: 'idle' });

  // Old results kept for backward compatibility in UI
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [longTestResult, setLongTestResult] = useState<{
    apiConnection?: boolean;
    jsonGeneration?: boolean;
    requiredFields?: { passed: boolean; missingFields: string[]; msg: string };
    refValidation?: { passed: boolean; msg: string };
  } | null>(null);

  useEffect(() => {
    const config = getAIConfig();
    if (config) {
      setApiUrl(config.apiUrl);
      setApiKey(config.apiKey);
      setModel(config.model);
    }
    // Restore saved test states
    const health = getApiHealth();
    if (health.tests) {
      if (health.tests.quickPing) {
        setQuickPing({ status: health.tests.quickPing.status === 'pass' ? 'pass' : 'fail', durationMs: health.tests.quickPing.durationMs, error: health.tests.quickPing.error });
      }
      if (health.tests.jsonTest) {
        setJsonTest({ status: health.tests.jsonTest.status === 'pass' ? 'pass' : 'fail', durationMs: health.tests.jsonTest.durationMs, error: health.tests.jsonTest.error });
      }
      if (health.tests.longJson) {
        setLongJson({ status: health.tests.longJson.status === 'pass' ? 'pass' : 'fail', durationMs: health.tests.longJson.durationMs, error: health.tests.longJson.error });
      }
      if (health.tests.refValidation) {
        setRefValidation({ status: health.tests.refValidation.status === 'pass' ? 'pass' : 'fail', error: health.tests.refValidation.reason });
      }
    }
  }, []);

  const hasConfig = apiUrl.trim() && apiKey.trim() && model.trim();
  const storedConfig = getAIConfig();
  const isTesting = quickPing.status === 'running' || jsonTest.status === 'running' || longJson.status === 'running';

  const setStatus = (status: AIConnectionStatus) => {
    saveAIConnectionStatus(status);
    setConnectionStatus(status);
  };

  const markConfigChanged = (nextApiUrl: string, nextApiKey: string, nextModel: string) => {
    setStatus(nextApiUrl.trim() && nextApiKey.trim() && nextModel.trim() ? 'failed' : 'unconfigured');
    setTestResult(null);
  };

  const handleSave = () => {
    if (!hasConfig) return;
    const normalizedApiUrl = normalizeApiUrl(apiUrl);
    setApiUrl(normalizedApiUrl);
    saveAIConfig({ apiUrl: normalizedApiUrl, apiKey: apiKey.trim(), model: model.trim() });
    clearAICache();
    clearApiHealth();
    setStatus('failed');
    setSaved(true);
    setTestResult(null);
    setLongTestResult(null);
    resetAllTests();
    setTimeout(() => setSaved(false), 2000);
  };

  const resetAllTests = () => {
    setQuickPing({ status: 'idle' });
    setJsonTest({ status: 'idle' });
    setLongJson({ status: 'idle' });
    setRefValidation({ status: 'idle' });
    setTestResult(null);
    setLongTestResult(null);
  };

  // ---- V4.9: Quick Ping Test ----
  const handleQuickPing = async () => {
    if (!hasConfig) return;
    const profile = getTimeoutProfile('quick_ping');
    setQuickPing({ status: 'running' });
    setTestResult(null);

    const startedAt = performance.now();
    try {
      const signal = AbortSignal?.timeout?.(profile.timeoutMs + profile.clientExtraMs) || undefined;
      const response = await fetch('/api/ai-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          apiUrl: normalizeApiUrl(apiUrl),
          apiKey: apiKey.trim(),
          timeoutMs: profile.timeoutMs,
          body: {
            model: model.trim(),
            messages: [
              { role: 'system', content: 'Return JSON only.' },
              { role: 'user', content: 'Return {"ok":true}.' },
            ],
            max_tokens: profile.maxTokens,
            temperature: 0,
          },
        }),
      });

      const durationMs = Math.round(performance.now() - startedAt);
      const rawText = await response.text();

      if (!response.ok) {
        let errMsg = `HTTP ${response.status}`;
        try { const ej = JSON.parse(rawText); errMsg = ej.error?.message || ej.error || errMsg; } catch { /* use status */ }
        setQuickPing({ status: 'fail', durationMs, error: errMsg });
        updateApiHealthTests({ quickPing: { status: 'fail', durationMs, error: errMsg } });
        markApiFailed('quick_ping_failed', `Quick Ping 失败 (${durationMs}ms): ${errMsg}`);
        saveAIConfig({ apiUrl: normalizeApiUrl(apiUrl), apiKey: apiKey.trim(), model: model.trim() });
        setStatus('failed');
        return;
      }

      let data: Record<string, unknown>;
      try { data = JSON.parse(rawText); } catch {
        setQuickPing({ status: 'fail', durationMs, error: 'Response not JSON' });
        updateApiHealthTests({ quickPing: { status: 'fail', durationMs } });
        markApiFailed('quick_ping_failed', `Quick Ping 失败 (${durationMs}ms): 响应不是 JSON`);
        setStatus('failed');
        return;
      }

      extractAIContent(data); // validate reachability

      setQuickPing({ status: 'pass', durationMs });
      updateApiHealthTests({ quickPing: { status: 'pass', durationMs } });
      setTestResult({ ok: true, msg: `Quick Ping 通过 (${durationMs}ms)！API 基本可达。` });
      setLastTiming(getLastAITiming());

      // If quick ping passes, check jsonTest state
      if (jsonTest.status === 'pass') {
        saveAIConfig({ apiUrl: normalizeApiUrl(apiUrl), apiKey: apiKey.trim(), model: model.trim() });
        setStatus('connected');
        if (longJson.status === 'pass' && refValidation.status === 'pass') {
          markApiReady({ model: model.trim(), apiUrl: normalizeApiUrl(apiUrl), tests: getApiHealth().tests });
        } else {
          markApiBasicReady({ model: model.trim(), apiUrl: normalizeApiUrl(apiUrl), tests: getApiHealth().tests });
        }
      }
    } catch (err) {
      const durationMs = Math.round(performance.now() - startedAt);
      const isTimeout = err && typeof err === 'object' && 'name' in err && (err as { name?: string }).name === 'TimeoutError';
      const errorMsg = isTimeout
        ? `Quick Ping 超时：项目在 ${Math.round(profile.timeoutMs / 1000)} 秒内没有拿到最小响应。可能是代理函数不可达、网络阻塞、API key 无效、模型名错误，或部署环境无法访问上游 API。`
        : `Quick Ping 失败：${err instanceof Error ? err.message : String(err)}`;
      setQuickPing({ status: 'fail', durationMs, error: errorMsg });
      updateApiHealthTests({ quickPing: { status: 'fail', durationMs, error: errorMsg } });
      markApiFailed('quick_ping_failed', errorMsg);
      setStatus('failed');
    } finally {
      setLastTiming(getLastAITiming());
    }
  };

  // ---- V4.9: JSON Test ----
  const handleJsonTest = async () => {
    if (!hasConfig) return;
    const profile = getTimeoutProfile('json_test');
    setJsonTest({ status: 'running' });

    const startedAt = performance.now();
    try {
      const signal = AbortSignal?.timeout?.(profile.timeoutMs + profile.clientExtraMs) || undefined;
      const response = await fetch('/api/ai-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          apiUrl: normalizeApiUrl(apiUrl),
          apiKey: apiKey.trim(),
          timeoutMs: profile.timeoutMs,
          body: {
            model: model.trim(),
            messages: [
              { role: 'system', content: '你是 API 连通性测试器。只返回 JSON，不要 Markdown。' },
              { role: 'user', content: '请返回 {"ok":true,"message":"连接成功","model":"<your model name>","task":"json_test"}，不要输出其他内容。' },
            ],
            max_tokens: profile.maxTokens,
            temperature: 0,
          },
        }),
      });

      const durationMs = Math.round(performance.now() - startedAt);
      const rawText = await response.text();

      if (!response.ok) {
        let errMsg = `HTTP ${response.status}`;
        try { const ej = JSON.parse(rawText); errMsg = ej.error?.message || ej.error || errMsg; } catch { /* use status */ }
        setJsonTest({ status: 'fail', durationMs, error: errMsg });
        updateApiHealthTests({ jsonTest: { status: 'fail', durationMs, error: errMsg } });
        markApiFailed('json_failed', `JSON Test 失败 (${durationMs}ms): ${errMsg}`);
        saveAIConfig({ apiUrl: normalizeApiUrl(apiUrl), apiKey: apiKey.trim(), model: model.trim() });
        setStatus('failed');
        return;
      }

      let data: Record<string, unknown>;
      try { data = JSON.parse(rawText); } catch {
        setJsonTest({ status: 'fail', durationMs, error: '响应不是有效 JSON' });
        updateApiHealthTests({ jsonTest: { status: 'fail', durationMs } });
        markApiFailed('json_failed', `JSON Test 失败 (${durationMs}ms): 响应不是有效 JSON`);
        setStatus('failed');
        return;
      }

      const content = extractAIContent(data);
      if (!content) {
        setJsonTest({ status: 'fail', durationMs, error: '模型返回为空' });
        updateApiHealthTests({ jsonTest: { status: 'fail', durationMs } });
        markApiFailed('json_failed', `JSON Test 失败 (${durationMs}ms): 模型返回为空`);
        setStatus('failed');
        return;
      }

      const parsed = extractJson<{ ok?: boolean }>(content);
      const isValid = parsed && parsed.ok === true;

      setJsonTest({ status: isValid ? 'pass' : 'fail', durationMs, error: isValid ? undefined : 'JSON 中 ok !== true' });
      updateApiHealthTests({ jsonTest: { status: isValid ? 'pass' : 'fail', durationMs } });
      setTestResult({ ok: true, msg: `JSON Test 通过 (${durationMs}ms)！模型可返回结构化 JSON。` });

      if (isValid && quickPing.status === 'pass') {
        saveAIConfig({ apiUrl: normalizeApiUrl(apiUrl), apiKey: apiKey.trim(), model: model.trim() });
        setStatus('connected');
        markApiBasicReady({ model: model.trim(), apiUrl: normalizeApiUrl(apiUrl), tests: getApiHealth().tests });
      } else if (!isValid) {
        markApiFailed('json_failed', `JSON Test: ok !== true (${durationMs}ms)`);
        setStatus('failed');
      }
    } catch (err) {
      const durationMs = Math.round(performance.now() - startedAt);
      const isTimeout = err && typeof err === 'object' && 'name' in err && (err as { name?: string }).name === 'TimeoutError';
      const errorMsg = isTimeout
        ? `JSON Test 超时：API 已发出请求，但模型没有在 ${Math.round(profile.timeoutMs / 1000)} 秒内返回小 JSON。请检查模型名是否为可用的快速模型。`
        : `JSON Test 失败：${err instanceof Error ? err.message : String(err)}`;
      setJsonTest({ status: 'fail', durationMs, error: errorMsg });
      updateApiHealthTests({ jsonTest: { status: 'fail', durationMs, error: errorMsg } });
      markApiFailed('json_failed', errorMsg);
      setStatus('failed');
    } finally {
      setLastTiming(getLastAITiming());
    }
  };

  // ---- V4.9: Long JSON Test (kept from V4.4 but with updated profile) ----
  const handleLongJsonTest = async () => {
    if (!hasConfig) return;
    const profile = getTimeoutProfile('long_json_test');
    setLongJson({ status: 'running' });
    setRefValidation({ status: 'idle' });
    setLongTestResult(null);

    const startedAt = performance.now();
    const result: NonNullable<typeof longTestResult> = {};

    try {
      const signal = AbortSignal?.timeout?.(profile.timeoutMs + profile.clientExtraMs) || undefined;

      const response = await fetch('/api/ai-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          apiUrl: normalizeApiUrl(apiUrl),
          apiKey: apiKey.trim(),
          timeoutMs: profile.timeoutMs,
          body: {
            model: model.trim(),
            messages: [
              {
                role: 'system' as const,
                content: '你是 VibePilot 的长 JSON 生成测试器。你必须只返回一个 JSON 对象，不要 markdown，不要解释，不要使用省略号，不要使用 "..." 作为字段值。',
              },
              {
                role: 'user' as const,
                content: `请基于以下产品想法生成一个可解析 JSON：

产品想法：雅思生词和错题管理工具
目标用户：正在备考雅思、需要复盘阅读和听力错题的学生
使用场景：做完剑桥雅思真题后整理生词、同义替换和错题原因
核心问题：生词、同义替换和错题原因分散记录，无法形成可复盘的词库和错题模式

必须返回以下顶层字段：
{
  "referenceEvidence": {
    "rawIdea": "必须复述产品想法",
    "targetUser": "必须复述目标用户",
    "scenario": "必须复述使用场景",
    "problem": "必须复述核心问题",
    "summary": "一句话说明输出如何基于当前产品想法"
  },
  "productBrief": "不少于 30 个中文字符，必须包含雅思、生词、错题",
  "mvpScope": "不少于 30 个中文字符，必须包含 Must Have 和 Out of Scope",
  "devSpec": "不少于 30 个中文字符，必须包含页面、数据结构、验收标准",
  "developmentPrompt": "不少于 30 个中文字符，必须说明要开发什么、不要开发什么、如何验收"
}

要求：
1. 只能返回 JSON，不要 markdown。
2. 不要使用省略号。
3. 不要使用空字符串。
4. 不要把字段嵌套到 data、result、output、content 里。
5. 所有字段值必须是字符串或对象。`,
              },
            ],
            max_tokens: profile.maxTokens,
            temperature: 0,
          },
        }),
      });

      const durationMs = Math.round(performance.now() - startedAt);

      result.apiConnection = response.ok;

      if (!response.ok) {
        setLongJson({ status: 'fail', durationMs, error: `HTTP ${response.status}` });
        updateApiHealthTests({ longJson: { status: 'fail', durationMs, error: `HTTP ${response.status}` } });
        setLongTestResult({
          apiConnection: false,
          jsonGeneration: false,
          requiredFields: { passed: false, missingFields: ['N/A'], msg: `API 请求失败 (${response.status})` },
          refValidation: { passed: false, msg: 'API 连接失败，无法校验。' },
        });
        markApiFailed('long_json_failed', `Long JSON: HTTP ${response.status} (${durationMs}ms)`);
        return;
      }

      const rawText = await response.text();
      let data: Record<string, unknown>;
      try { data = JSON.parse(rawText); } catch {
        setLongJson({ status: 'fail', durationMs, error: '代理返回的不是有效 JSON' });
        updateApiHealthTests({ longJson: { status: 'fail', durationMs } });
        setLongTestResult({
          apiConnection: true,
          jsonGeneration: false,
          requiredFields: { passed: false, missingFields: ['N/A'], msg: '代理返回的不是有效 JSON' },
          refValidation: { passed: false, msg: '代理响应格式错误。' },
        });
        markApiFailed('json_failed', `Long JSON parse failed (${durationMs}ms)`);
        return;
      }

      const content = extractAIContent(data);
      if (!content) {
        setLongJson({ status: 'fail', durationMs, error: '模型返回为空' });
        updateApiHealthTests({ longJson: { status: 'fail', durationMs } });
        setLongTestResult({
          apiConnection: true,
          jsonGeneration: false,
          requiredFields: { passed: false, missingFields: ['N/A'], msg: '模型返回为空' },
          refValidation: { passed: false, msg: '模型无响应内容。' },
        });
        markApiFailed('json_failed', `Long JSON empty (${durationMs}ms)`);
        return;
      }

      const parsed = extractJson<Record<string, unknown>>(content);
      if (!parsed) {
        setLongJson({ status: 'fail', durationMs, error: 'JSON 解析失败' });
        updateApiHealthTests({ longJson: { status: 'fail', durationMs } });
        setLongTestResult({
          apiConnection: true,
          jsonGeneration: false,
          requiredFields: { passed: false, missingFields: ['N/A'], msg: '模型返回无法解析为 JSON' },
          refValidation: { passed: false, msg: `JSON 解析失败。原始内容：${content.slice(0, 160)}` },
        });
        markApiFailed('json_failed', `Long JSON parse failed: cannot parse (${durationMs}ms)`);
        return;
      }

      result.jsonGeneration = true;
      setLongJson({ status: 'pass', durationMs });
      updateApiHealthTests({ longJson: { status: 'pass', durationMs } });

      const fieldChecks = {
        referenceEvidence: parsed.referenceEvidence && typeof parsed.referenceEvidence === 'object',
        productBrief: isUsefulString(parsed.productBrief, 20),
        mvpScope: isUsefulString(parsed.mvpScope, 20),
        devSpec: isUsefulString(parsed.devSpec, 20),
        developmentPrompt: isUsefulString(parsed.developmentPrompt, 20),
      };

      const missingFields = Object.entries(fieldChecks)
        .filter(([, ok]) => !ok)
        .map(([key]) => key);

      if (missingFields.length > 0) {
        const isDotDotDot = (
          (typeof parsed.productBrief === 'string' && parsed.productBrief === '...') ||
          (typeof parsed.mvpScope === 'string' && parsed.mvpScope === '...') ||
          (typeof parsed.devSpec === 'string' && parsed.devSpec === '...') ||
          (typeof parsed.developmentPrompt === 'string' && parsed.developmentPrompt === '...')
        );
        const hint = isDotDotDot
          ? '模型可能只复制了模板中的省略号。请检查模型是否理解要求，或在 prompt 中强调不要使用省略号。'
          : '请检查模型是否只是复读模板或返回省略号/空字符串。';

        setLongTestResult({
          ...result,
          requiredFields: { passed: false, missingFields, msg: `关键字段质量不足：${missingFields.join(', ')}。${hint}` },
          refValidation: { passed: false, msg: '字段不足，无法校验内容相关性。' },
        });
        markApiFailed('validation_failed', `Long JSON: fields missing (${missingFields.join(', ')})`);
        return;
      }

      result.requiredFields = { passed: true, missingFields: [], msg: '全部关键字段可用。' };

      const validation = validateAIOutputReferencesInput(LONG_TEST_BRIEF, parsed);
      result.refValidation = {
        passed: validation.passed,
        msg: validation.passed ? `通过：${validation.reason}` : `相关性不足：${validation.reason}`,
      };

      setRefValidation({ status: validation.passed ? 'pass' : 'fail', error: validation.reason });
      updateApiHealthTests({ refValidation: { status: validation.passed ? 'pass' : 'fail', reason: validation.reason } });

      setLongTestResult(result);
      saveAIConfig({ apiUrl: normalizeApiUrl(apiUrl), apiKey: apiKey.trim(), model: model.trim() });
      setStatus('connected');

      const allPassed = result.apiConnection && result.jsonGeneration && result.requiredFields.passed && result.refValidation.passed;
      if (allPassed) {
        markApiReady({ model: model.trim(), apiUrl: normalizeApiUrl(apiUrl), tests: getApiHealth().tests });
      } else {
        const health = getApiHealth();
        if (health.status === 'basic_ready') {
          // Keep basic_ready if Quick Ping + JSON Test already passed
        } else {
          markApiFailed('validation_failed', `API 验证部分失败。Conn:${result.apiConnection} JSON:${result.jsonGeneration} Fields:${result.requiredFields.passed} Ref:${result.refValidation.passed}`);
        }
      }
    } catch (err) {
      const durationMs = Math.round(performance.now() - startedAt);
      const isTimeout = err && typeof err === 'object' && 'name' in err && (err as { name?: string }).name === 'TimeoutError';
      const errorMsg = isTimeout
        ? `Long JSON Test 超时：基础 API 可能可用，但当前模型生成结构化长 JSON 太慢。建议换更快模型、降低输出长度，或开启流式/后台生成。`
        : `Long JSON 测试失败：${err instanceof Error ? err.message : String(err)}`;
      setLongJson({ status: 'fail', durationMs, error: errorMsg });
      updateApiHealthTests({ longJson: { status: 'fail', durationMs, error: errorMsg } });
      markApiFailed('long_json_failed', errorMsg);
      setLongTestResult({
        apiConnection: false,
        jsonGeneration: false,
        requiredFields: { passed: false, missingFields: [], msg: '' },
        refValidation: { passed: false, msg: isTimeout ? '长 JSON 生成超时，建议换更快模型' : `错误：${err instanceof Error ? err.message : String(err)}` },
      });
    } finally {
      setLastTiming(getLastAITiming());
    }
  };

  // ---- Run all tests sequentially ----
  const handleRunAllTests = async () => {
    if (!hasConfig || isTesting) return;
    resetAllTests();

    // Step 1: Quick Ping — delegate to existing handler
    await handleQuickPing();
    // Wait for state to settle
    await new Promise((r) => setTimeout(r, 300));

    // Step 2: JSON Test
    await handleJsonTest();
    await new Promise((r) => setTimeout(r, 300));

    // Step 3: Long JSON
    await handleLongJsonTest();
  };

  const handleClear = () => {
    clearAIConfig();
    clearApiHealth();
    setStatus('unconfigured');
    setApiUrl('');
    setApiKey('');
    setModel('');
    setTestResult(null);
    resetAllTests();
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setApiUrl(preset.apiUrl);
    setModel(preset.model);
    markConfigChanged(preset.apiUrl, apiKey, preset.model);
  };

  const isBasicReady = quickPing.status === 'pass' && jsonTest.status === 'pass';
  const isFullReady = isBasicReady && longJson.status === 'pass' && refValidation.status === 'pass';

  return (
    <PageReveal style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="vp-header">
        <div style={{ maxWidth: 640, margin: '0 auto', width: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="vp-btn-text" onClick={() => navigate('/')} style={{ padding: '4px 6px' }} title="返回主页">
            <Home size={18} />
          </button>
          <Brain size={16} style={{ color: 'var(--color-primary)' }} />
          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>VibePilot</span>
          <span style={{ color: 'var(--color-text-hint)' }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 500 }}>AI 设置</span>
          <div style={{ marginLeft: 'auto' }}>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main style={{ flex: 1, padding: '2rem' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {/* V4.9: API Runtime Status Card */}
          {(() => {
            const health = getApiHealth();
            const statusColors: Record<ApiHealthStatus, string> = {
              unknown: 'var(--color-warning)',
              not_configured: 'var(--color-text-hint)',
              proxy_failed: 'var(--color-danger)',
              quick_ping_failed: 'var(--color-danger)',
              json_failed: 'var(--color-danger)',
              long_json_failed: 'var(--color-warning)',
              validation_failed: 'var(--color-warning)',
              basic_ready: 'var(--color-success)',
              ready: 'var(--color-success)',
            };
            const statusLabels: Record<ApiHealthStatus, string> = {
              unknown: '状态未知',
              not_configured: '未配置',
              proxy_failed: '代理不可达',
              quick_ping_failed: 'Quick Ping 失败',
              json_failed: 'JSON 生成失败',
              long_json_failed: '长 JSON 失败',
              validation_failed: '输出校验失败',
              basic_ready: '基础可用 ✓',
              ready: '全功能就绪 ✓',
            };
            const color = statusColors[health.status] || 'var(--color-text-hint)';
            const label = statusLabels[health.status] || '未知';
            const isReady = health.status === 'ready' || health.status === 'basic_ready';
            return (
              <LiquidCard
                style={{
                  marginBottom: 16,
                  borderColor: isReady ? 'rgba(52,199,89,0.25)' : `${color}30`,
                  boxShadow: isReady ? '0 0 24px rgba(52,199,89,0.10), var(--vp-shadow-inner)' : undefined,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: color,
                      display: 'inline-block',
                      boxShadow: isReady ? `0 0 8px ${color}` : undefined,
                    }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color }}>API Runtime: {label}</span>
                    {health.model && <LiquidBadge variant="blue">{health.model}</LiquidBadge>}
                  </div>
                  {!isReady && (
                    <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                      {health.status === 'basic_ready' ? 'Agent 可运行，Handoff 需完整验证' : '需要 Basic Ready 才能运行 Agent'}
                    </span>
                  )}
                </div>
                {health.checkedAt && <p style={{ fontSize: 10, color: 'var(--color-text-hint)', marginTop: 8 }}>上次检查: {new Date(health.checkedAt).toLocaleString()}</p>}
                {health.message && <p style={{ fontSize: 11, color: 'var(--color-text-hint)', marginTop: 4 }}>{health.message}</p>}
              </LiquidCard>
            );
          })()}

          {/* Intro */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Settings size={22} style={{ color: 'var(--color-primary)' }} />
              AI 模型配置
            </h1>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
              接入你自己的大模型 API，获得更智能的产品思维训练体验。
              支持 OpenAI 兼容格式的 API（OpenAI、DeepSeek、GLM 等）。
            </p>
            <p style={{ fontSize: 13, color: 'var(--color-text-hint)', lineHeight: 1.6, marginTop: 8 }}>
              你的 API Key 仅存储在浏览器本地，不会发送到任何第三方服务器。
            </p>
          </div>

          {/* Current status */}
          {storedConfig ? (
            <LiquidCard
              style={{ marginBottom: 24, borderColor: 'rgba(52,199,89,0.15)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Zap size={16} style={{ color: isFullReady ? 'var(--color-success)' : isBasicReady ? 'var(--color-success)' : 'var(--color-warning)' }} />
                <span style={{ fontSize: 14, fontWeight: 500, color: isFullReady ? 'var(--color-success)' : isBasicReady ? 'var(--color-success)' : 'var(--color-warning)' }}>
                  {isFullReady ? 'AI 模型全功能就绪' : isBasicReady ? 'AI 模型基础可用' : 'AI 模型已配置，尚未测试成功'}
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                当前模型：<strong>{storedConfig.model}</strong>
                &nbsp;·&nbsp;
                {storedConfig.apiUrl}
              </p>
              {!isBasicReady && connectionStatus !== 'connected' && (
                <p style={{ fontSize: 12, color: 'var(--color-warning)', lineHeight: 1.6, marginTop: 6 }}>
                  保存配置不等于连接成功。请运行 API 测试，通过 Quick Ping 和 JSON Test 后 Agent 才能运行。
                </p>
              )}
            </LiquidCard>
          ) : (
            <LiquidCard
              style={{ marginBottom: 24, borderColor: 'rgba(255,149,0,0.20)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <AlertTriangle size={16} style={{ color: 'var(--color-warning)' }} />
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-warning)' }}>
                  未配置 AI 模型
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                生产环境必须连接并测试 AI 模型成功后，才能生成有效分析。
              </p>
            </LiquidCard>
          )}

          {/* Presets */}
          <LiquidCard style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>快速配置</h3>
            <p style={{ fontSize: 12, color: 'var(--color-text-hint)', marginBottom: 12 }}>
              选择一个平台，自动填入 API 地址和模型名称。你只需填入 API Key。
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  className="vp-btn vp-btn-ghost"
                  onClick={() => applyPreset(p)}
                  style={{ fontSize: 13 }}
                >
                  {p.name}
                  <ExternalLink size={12} />
                </button>
              ))}
            </div>
          </LiquidCard>

          {/* Config form */}
          <LiquidCard style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>API 地址</label>
              <input
                className="vp-textarea"
                style={{ fontFamily: 'monospace', fontSize: 13, padding: '10px 14px' }}
                value={apiUrl}
                onChange={(e) => { setApiUrl(e.target.value); markConfigChanged(e.target.value, apiKey, model); }}
                placeholder="https://api.openai.com"
              />
              <p style={{ fontSize: 12, color: 'var(--color-text-hint)', marginTop: 4 }}>
                如果你的服务商不是 OpenAI-compatible，请填写完整 endpoint，例如以 /chat/completions 结尾。
              </p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>API Key</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="vp-textarea"
                  type={showKey ? 'text' : 'password'}
                  style={{ fontFamily: 'monospace', fontSize: 13, padding: '10px 14px', paddingRight: 40 }}
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); markConfigChanged(apiUrl, e.target.value, model); }}
                  placeholder="sk-..."
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-hint)', padding: 4 }}
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p style={{ fontSize: 12, color: 'var(--color-text-hint)', marginTop: 4 }}>仅存储在浏览器 localStorage，不会上传</p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>模型名称</label>
              <input
                className="vp-textarea"
                style={{ fontFamily: 'monospace', fontSize: 13, padding: '10px 14px' }}
                value={model}
                onChange={(e) => { setModel(e.target.value); markConfigChanged(apiUrl, apiKey, e.target.value); }}
                placeholder="gpt-4o"
              />
              <p style={{ fontSize: 12, color: 'var(--color-text-hint)', marginTop: 4 }}>API 支持的具体模型名称</p>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="vp-btn vp-btn-primary" onClick={handleSave} disabled={!hasConfig || saved}>
                {saved ? <><Check size={14} /> 已保存</> : '保存配置'}
              </button>
              <button className="vp-btn vp-btn-ghost" onClick={handleQuickPing} disabled={!hasConfig || quickPing.status === 'running'}>
                {quickPing.status === 'running' ? <><Loader2 size={14} className="vp-spin" /> 测试中...</> : 'Quick Ping'}
              </button>
              <button className="vp-btn vp-btn-ghost" onClick={handleJsonTest} disabled={!hasConfig || jsonTest.status === 'running'}>
                {jsonTest.status === 'running' ? <><Loader2 size={14} className="vp-spin" /> 测试中...</> : 'JSON Test'}
              </button>
              <button className="vp-btn vp-btn-ghost" onClick={handleLongJsonTest} disabled={!hasConfig || longJson.status === 'running'}>
                {longJson.status === 'running' ? <><Loader2 size={14} className="vp-spin" /> 测试中...</> : '长 JSON 测试'}
              </button>
              <button className="vp-btn vp-btn-ghost" onClick={handleRunAllTests} disabled={!hasConfig || isTesting}>
                {isTesting ? <><Loader2 size={14} className="vp-spin" /> 测试中...</> : '一键测试全部'}
              </button>
              {storedConfig && (
                <button className="vp-btn vp-btn-danger-text" onClick={handleClear} style={{ fontSize: 13, color: 'var(--color-danger)' }}>
                  <Trash2 size={14} /> 清除配置
                </button>
              )}
            </div>
          </LiquidCard>

          {/* V4.9: API Diagnostics Card — layered test results */}
          <LiquidCard style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Activity size={14} />
              API 分层诊断
            </h3>
            <div style={{ display: 'grid', gap: 8 }}>
              {[
                { label: '1. Quick Ping (12s)', result: quickPing, desc: '验证 API 地址和 Key 是否基本可用' },
                { label: '2. JSON Test (30s)', result: jsonTest, desc: '验证模型能否返回小 JSON' },
                { label: '3. Long JSON (90s)', result: longJson, desc: '验证模型能否返回结构化长 JSON' },
                { label: '4. Reference Validation', result: refValidation, desc: '验证输出与输入相关性' },
              ].map((item) => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
                  <span>
                    {item.result.status === 'running' ? <Loader2 size={12} className="vp-spin" /> :
                     item.result.status === 'pass' ? '✅' :
                     item.result.status === 'fail' ? '❌' : '○'}
                  </span>
                  <div style={{ flex: 1 }}>
                    <span><strong>{item.label}</strong></span>
                    {item.result.durationMs != null && (
                      <span style={{ fontSize: 11, color: 'var(--color-text-hint)', marginLeft: 8 }}>{item.result.durationMs}ms</span>
                    )}
                    {item.result.error && (
                      <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 2, lineHeight: 1.5 }}>{item.result.error}</div>
                    )}
                    {item.result.status === 'idle' && (
                      <div style={{ fontSize: 11, color: 'var(--color-text-hint)', marginTop: 2 }}>{item.desc}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Status summary */}
            <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--vp-surface)', fontSize: 12, lineHeight: 1.6 }}>
              <strong>状态：</strong>
              {isFullReady ? '✅ 全功能就绪 — 所有测试通过，Agent 和 Handoff 均可运行' :
               isBasicReady ? '⚠️ 基础可用 — Quick Ping + JSON 通过，Agent 可运行，但 Handoff 等需要完整验证' :
               '❌ API 尚未就绪 — 需要至少通过 Quick Ping 和 JSON Test'}
            </div>
          </LiquidCard>

          {/* V4.9: Last AI Timing */}
          {lastTiming && (
            <LiquidCard style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>最近 AI 耗时</h3>
              <div style={{ fontSize: 12, lineHeight: 1.8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                <span style={{ color: 'var(--color-text-hint)' }}>Model</span><span>{lastTiming.model}</span>
                <span style={{ color: 'var(--color-text-hint)' }}>Timeout</span><span>{lastTiming.timeoutMs}ms ({Math.round(lastTiming.timeoutMs / 1000)}s)</span>
                <span style={{ color: 'var(--color-text-hint)' }}>Duration</span><span style={{ color: lastTiming.ok ? 'var(--color-success)' : 'var(--color-danger)' }}>{lastTiming.durationMs}ms</span>
                <span style={{ color: 'var(--color-text-hint)' }}>Proxy</span><span>{lastTiming.proxyDurationMs || '-'}ms</span>
                <span style={{ color: 'var(--color-text-hint)' }}>Upstream</span><span>{lastTiming.upstreamDurationMs || '-'}ms</span>
                <span style={{ color: 'var(--color-text-hint)' }}>Status</span><span style={{ color: lastTiming.ok ? 'var(--color-success)' : 'var(--color-danger)' }}>{lastTiming.ok ? 'OK' : `HTTP ${lastTiming.status}`}</span>
                <span style={{ color: 'var(--color-text-hint)' }}>Chars</span><span>{lastTiming.responseChars}</span>
                <span style={{ color: 'var(--color-text-hint)' }}>Endpoint</span><span style={{ fontSize: 10 }}>{lastTiming.endpoint}</span>
                <span style={{ color: 'var(--color-text-hint)' }}>Time</span><span style={{ fontSize: 10 }}>{lastTiming.timestamp ? new Date(lastTiming.timestamp).toLocaleTimeString() : '-'}</span>
              </div>
            </LiquidCard>
          )}

          {/* Long JSON test result (legacy detail) */}
          {longTestResult && (
            <LiquidCard style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>长 JSON 生成测试详情</h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {[
                  { label: 'API Connection', passed: longTestResult.apiConnection },
                  { label: 'JSON Parse', passed: longTestResult.jsonGeneration },
                  { label: 'Required Fields', passed: longTestResult.requiredFields?.passed, msg: longTestResult.requiredFields?.msg, missing: longTestResult.requiredFields?.missingFields },
                  { label: 'Reference Validation', passed: longTestResult.refValidation?.passed, msg: longTestResult.refValidation?.msg },
                ].map((item) => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
                    <span>{item.passed ? '✅' : '❌'}</span>
                    <div>
                      <span><strong>{item.label}:</strong> {item.passed ? '通过' : item.msg || '不通过'}</span>
                      {item.missing && item.missing.length > 0 && (
                        <div style={{ fontSize: 12, color: 'var(--color-text-hint)', marginTop: 4 }}>
                          缺失/不足: {item.missing.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </LiquidCard>
          )}

          {/* Short test result */}
          {testResult && (
            <LiquidCard
              style={{ marginBottom: 16, borderColor: testResult.ok ? 'rgba(52,199,89,0.15)' : 'rgba(255,59,48,0.15)' }}
            >
              <p style={{ fontSize: 13, color: testResult.ok ? 'var(--color-success)' : 'var(--color-danger)', lineHeight: 1.6 }}>
                {testResult.ok ? '✅ ' : '❌ '}{testResult.msg}
              </p>
            </LiquidCard>
          )}

          {/* Help */}
          <div className="vp-card-dashed" style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>常见问题</h3>
            <div style={{ textAlign: 'left', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
              <p style={{ marginBottom: 8 }}>
                <strong>Q: 支持哪些 API？</strong><br />
                A: 任何 OpenAI 兼容格式的 API 都支持，包括 OpenAI、DeepSeek、智谱 GLM、通义千问、Moonshot、Ollama 本地部署等。
              </p>
              <p style={{ marginBottom: 8 }}>
                <strong>Q: API Key 安全吗？</strong><br />
                A: Key 只存在你的浏览器 localStorage 中，请求会通过当前应用的同源代理转发到你填写的 API 地址，用来避免浏览器 CORS 限制。
              </p>
              <p style={{ marginBottom: 8 }}>
                <strong>Q: 不配置 AI 能用吗？</strong><br />
                A: 正式生成不能用。生产环境必须先通过 Quick Ping 和 JSON Test。
              </p>
              <p>
                <strong>Q: 为什么官方 API 也超时？</strong><br />
                A: V4.9 已修复。旧版本有 40s 前端硬超时 + 50s 代理硬限制，会主动中断慢模型。现在使用分层 timeout（12s/30s/90s），Quick Ping 只需 12s 即可验证 API 基础可用性。
              </p>
            </div>
          </div>
        </div>
      </main>
    </PageReveal>
  );
}
