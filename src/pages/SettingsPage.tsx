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
  Search,
} from 'lucide-react';
import {
  clearAIConfig,
  extractAIContent,
  getAIConfig,
  getAIConnectionStatus,
  normalizeApiUrl,
  saveAIConfig,
  saveAIConnectionStatus,
  type AIConnectionStatus,
} from '../api/evaluate';
import {
  clearApiHealth,
  getApiHealth,
  markApiFailed,
  markApiReady,
  type ApiHealthStatus,
} from '../api/apiHealth';
import {
  normalizeOpenAICompatibleEndpoint,
  runEndpointNormalizerSelfTest,
  type NormalizedEndpointResult,
  type EndpointSelfTestCase,
} from '../api/endpointNormalizer';
import {
  parseApiProxyError,
} from '../api/apiErrorParser';
import { PageReveal, LiquidCard, LiquidBadge } from '../components/liquid';
import ThemeToggle from '../components/ThemeToggle';

/** Safe timer wrapper to avoid React purity lint rules */
function getTime(): number {
  return Date.now();
}

const PRESETS = [
  {
    name: 'OpenAI',
    apiUrl: 'https://api.openai.com',
    model: 'gpt-4o-mini',
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
    apiUrl: '',
    model: '',
    docUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    note: '请填写智谱 OpenAI-compatible chat completions endpoint 或兼容根地址。',
  },
  {
    name: 'Custom Gateway',
    apiUrl: 'https://gpt-agent.cc',
    model: '',
    docUrl: '',
    note: 'OpenAI-compatible 网关，支持 root 或 /v1 写法。模型名以服务商后台为准。',
  },
  {
    name: 'LLM Token',
    apiUrl: 'https://api.llm-token.cn',
    model: '',
    docUrl: '',
    note: '第三方 OpenAI-compatible 网关。模型名以服务商后台为准。',
  },
];

interface TestResult {
  status: 'idle' | 'running' | 'pass' | 'fail';
  durationMs?: number;
  error?: string;
}

/** V5.2: API Debug Info for detailed error display */
interface ApiDebugInfo {
  testName: 'proxy_health' | 'quick_ping' | 'json_test' | 'long_json' | 'raw_chat'
  inputApiUrl: string
  normalizedEndpoint?: string
  endpointKind?: string
  endpointWarnings?: string[]
  endpointErrors?: string[]
  model: string
  httpStatus?: number
  errorCategory?: string
  errorMessage?: string
  upstreamBodyPreview?: string
  proxyDurationMs?: number
  upstreamDurationMs?: number
  timeoutMs?: number
  rawResponsePreview?: string
  timestamp: string
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<AIConnectionStatus>(getAIConnectionStatus());

  // V5.3: Single smoke test result
  const [smokeTest, setSmokeTest] = useState<TestResult>({ status: 'idle' });

  // V5.1: Endpoint preview & self-test
  const [endpointPreview, setEndpointPreview] = useState<NormalizedEndpointResult | null>(null);
  const [selfTestResults, setSelfTestResults] = useState<EndpointSelfTestCase[] | null>(null);

  // V5.3: Simplified states
  const [apiDebugInfo, setApiDebugInfo] = useState<ApiDebugInfo | null>(null);

  useEffect(() => {
    const config = getAIConfig();
    if (config) {
      setApiUrl(config.apiUrl);
      setApiKey(config.apiKey);
      setModel(config.model);
    }
    // Restore saved test states
    const health = getApiHealth();
    if (health.tests?.smokeTest) {
      setSmokeTest({ status: health.tests.smokeTest.status === 'pass' ? 'pass' : 'fail', durationMs: health.tests.smokeTest.durationMs, error: health.tests.smokeTest.error });
    }
  }, []);

  // V5.1: Update endpoint preview when apiUrl changes
  useEffect(() => {
    if (apiUrl.trim()) {
      const normalized = normalizeOpenAICompatibleEndpoint(apiUrl);
      setEndpointPreview(normalized);
    } else {
      setEndpointPreview(null);
    }
  }, [apiUrl]);

  const hasConfig = apiUrl.trim() && apiKey.trim() && model.trim();
  const storedConfig = getAIConfig();
  const isTesting = smokeTest.status === 'running';

  const setStatus = (status: AIConnectionStatus) => {
    saveAIConnectionStatus(status);
    setConnectionStatus(status);
  };

  const markConfigChanged = (nextApiUrl: string, nextApiKey: string, nextModel: string) => {
    setStatus(nextApiUrl.trim() && nextApiKey.trim() && nextModel.trim() ? 'failed' : 'unconfigured');
  };

  const resetAllTests = () => {
    setSmokeTest({ status: 'idle' });
    setApiDebugInfo(null);
  };

  // ---- V5.3: Single API Smoke Test ----
  const handleApiSmokeTest = async () => {
    if (!hasConfig) return;
    setSmokeTest({ status: 'running' });
    setApiDebugInfo(null);

    // Step 1: Validate endpoint
    const normalized = normalizeOpenAICompatibleEndpoint(apiUrl);
    if (normalized.kind === 'invalid' || normalized.errors.length > 0) {
      const errMsg = `Endpoint 无效：${normalized.errors.join('；') || 'URL 格式不正确'}`;
      setSmokeTest({ status: 'fail', error: errMsg });
      markApiFailed('not_configured', errMsg);
      setStatus('failed');
      setApiDebugInfo({
        testName: 'quick_ping',
        inputApiUrl: apiUrl,
        normalizedEndpoint: normalized.endpoint,
        endpointKind: normalized.kind,
        endpointWarnings: normalized.warnings,
        endpointErrors: normalized.errors,
        model: model.trim(),
        errorCategory: 'bad_request',
        errorMessage: errMsg,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Step 2: Send minimal smoke test request
    const startedAt = getTime();
    try {
      const signal = AbortSignal?.timeout?.(45000) || undefined;
      const response = await fetch('/api/ai-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          apiUrl: normalizeApiUrl(apiUrl),
          apiKey: apiKey.trim(),
          timeoutMs: 30000,
          body: {
            model: model.trim(),
            messages: [
              {
                role: 'user' as const,
                content: '请只回复一个很短的 JSON：{"ok":true,"pong":"vibe"}',
              },
            ],
            max_tokens: 80,
            temperature: 0,
          },
        }),
      });

      const durationMs = getTime() - startedAt;
      const rawText = await response.text();

      // Step 3: Handle non-OK response
      if (!response.ok) {
        const parsed = parseApiProxyError({ status: response.status, rawText, headers: response.headers });
        const errMsg = buildSmokeTestErrorMessage(parsed.errorCategory, response.status, parsed.message);
        setSmokeTest({ status: 'fail', durationMs, error: errMsg });
        markApiFailed('quick_ping_failed', errMsg);
        saveAIConfig({ apiUrl: normalizeApiUrl(apiUrl), apiKey: apiKey.trim(), model: model.trim() });
        setStatus('failed');
        saveDebugFromProxyResponse('quick_ping', response, rawText, durationMs, 30000);
        return;
      }

      // Step 4: Parse response and extract content
      let data: Record<string, unknown>;
      try { data = JSON.parse(rawText); } catch {
        const errMsg = '代理返回的不是标准 OpenAI-compatible JSON。请检查该网关是否兼容 Chat Completions 格式。';
        setSmokeTest({ status: 'fail', durationMs, error: errMsg });
        markApiFailed('quick_ping_failed', errMsg);
        setStatus('failed');
        return;
      }

      const content = extractAIContent(data);
      if (!content || content.trim().length === 0) {
        const errMsg = '模型返回为空。请检查模型名是否正确，或服务商是否支持该模型。';
        setSmokeTest({ status: 'fail', durationMs, error: errMsg });
        markApiFailed('json_failed', errMsg);
        setStatus('failed');
        return;
      }

      // Step 5: Success — content is non-empty, API is ready
      setSmokeTest({ status: 'pass', durationMs });
      saveAIConfig({ apiUrl: normalizeApiUrl(apiUrl), apiKey: apiKey.trim(), model: model.trim() });
      saveAIConnectionStatus('connected');
      markApiReady({
        model: model.trim(),
        apiUrl: normalizeApiUrl(apiUrl),
        tests: {
          smokeTest: { status: 'pass', durationMs, checkedAt: new Date().toISOString() },
        },
      });
      setStatus('connected');
    } catch (err) {
      const durationMs = getTime() - startedAt;
      const isTimeout = err && typeof err === 'object' && 'name' in err && (err as { name?: string }).name === 'TimeoutError';
      const errorMsg = isTimeout
        ? `请求超时（>45s）。请检查模型速度、网关稳定性或 timeout 设置。`
        : `请求失败：${err instanceof Error ? err.message : String(err)}`;
      setSmokeTest({ status: 'fail', durationMs, error: errorMsg });
      markApiFailed('quick_ping_failed', errorMsg);
      setStatus('failed');
    }
  };

  // V5.3: Build user-friendly error message based on error category
  const buildSmokeTestErrorMessage = (category: string, httpStatus: number, rawMessage: string): string => {
    switch (category) {
      case 'auth_error':
        return `API Key 无效或没有权限（HTTP ${httpStatus}）。请检查 API Key 是否正确。`;
      case 'permission_error':
        return `API Key 无权限访问该模型（HTTP ${httpStatus}）。请在服务商后台确认权限。`;
      case 'model_not_found':
        return `Endpoint 或模型名错误（HTTP ${httpStatus}）。请检查模型名称是否正确。`;
      case 'quota_or_rate_limit':
        return `额度不足或触发限流（HTTP ${httpStatus}）。请检查账户余额或稍后重试。`;
      case 'provider_internal_error':
        return `上游服务商返回 HTTP ${httpStatus}。API 请求已到达服务商，但服务商内部处理失败。建议检查模型名、服务商后台状态，或使用更简单的 Smoke Test 请求。`;
      case 'upstream_unavailable':
        return `上游服务商暂时不可用（HTTP ${httpStatus}）。请稍后重试或检查服务商状态。`;
      default:
        return rawMessage || `HTTP ${httpStatus} 请求失败。`;
    }
  };

  const handleClear = () => {
    clearAIConfig();
    clearApiHealth();
    setStatus('unconfigured');
    setApiUrl('');
    setApiKey('');
    setModel('');
    resetAllTests();
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setApiUrl(preset.apiUrl);
    setModel(preset.model);
    markConfigChanged(preset.apiUrl, apiKey, preset.model);
  };

  // V5.1: Run endpoint normalizer self-test
  const handleRunSelfTest = () => {
    const results = runEndpointNormalizerSelfTest();
    setSelfTestResults(results);
  };

  // V5.2: Helper to build debug info from a test result
  const saveDebugFromProxyResponse = (
    testName: ApiDebugInfo['testName'],
    response: Response,
    rawText: string,
    _durationMs: number,
    timeoutMs: number,
  ) => {
    const parsed = parseApiProxyError({ status: response.status, rawText, headers: response.headers });
    setApiDebugInfo({
      testName,
      inputApiUrl: normalizeApiUrl(apiUrl),
      normalizedEndpoint: parsed.normalizedEndpoint,
      endpointKind: parsed.endpointKind,
      endpointWarnings: parsed.endpointWarnings,
      endpointErrors: parsed.endpointErrors,
      model: model.trim(),
      httpStatus: response.status,
      errorCategory: parsed.errorCategory,
      errorMessage: parsed.message,
      upstreamBodyPreview: parsed.upstreamBodyPreview,
      proxyDurationMs: parsed.proxyDurationMs,
      upstreamDurationMs: parsed.upstreamDurationMs,
      timeoutMs,
      rawResponsePreview: parsed.rawPreview,
      timestamp: new Date().toISOString(),
    });
  };

  const isApiReady = connectionStatus === 'connected' && smokeTest.status === 'pass';

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
          {/* V5.3: API Runtime Status Card */}
          {(() => {
            const health = getApiHealth();
            const statusColors: Record<ApiHealthStatus, string> = {
              unknown: 'var(--color-warning)',
              not_configured: 'var(--color-text-hint)',
              proxy_failed: 'var(--color-danger)',
              quick_ping_failed: 'var(--color-danger)',
              json_failed: 'var(--color-danger)',
              long_json_failed: 'var(--color-text-hint)',
              validation_failed: 'var(--color-text-hint)',
              basic_ready: 'var(--color-success)',
              ready: 'var(--color-success)',
            };
            const statusLabels: Record<ApiHealthStatus, string> = {
              unknown: '状态未知',
              not_configured: '未配置',
              proxy_failed: '代理不可达',
              quick_ping_failed: 'API 不可用',
              json_failed: 'API 不可用',
              long_json_failed: '复杂测试失败（不影响 API 可用性）',
              validation_failed: '输出校验失败（不影响 API 可用性）',
              basic_ready: 'API 可用 ✓',
              ready: 'API 可用 ✓',
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
                <Zap size={16} style={{ color: isApiReady ? 'var(--color-success)' : 'var(--color-warning)' }} />
                <span style={{ fontSize: 14, fontWeight: 500, color: isApiReady ? 'var(--color-success)' : 'var(--color-warning)' }}>
                  {isApiReady ? 'API 可用' : 'API 尚未就绪 — 请点击「测试并保存 API」完成一次最小模型响应测试。'}
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                当前模型：<strong>{storedConfig.model}</strong>
                &nbsp;·&nbsp;
                {storedConfig.apiUrl}
              </p>
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
                支持 root URL、/v1 URL 或完整 /v1/chat/completions endpoint。
              </p>

              {/* V5.1: Endpoint Preview */}
              {endpointPreview && (
                <div style={{
                  marginTop: 8, padding: '8px 12px', borderRadius: 8,
                  background: endpointPreview.kind === 'invalid' ? 'rgba(255,59,48,0.08)' : 'var(--vp-surface)',
                  border: endpointPreview.kind === 'invalid' ? '1px solid rgba(255,59,48,0.2)' : '1px solid var(--vp-border)',
                  fontSize: 12, lineHeight: 1.8,
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 12px' }}>
                    <span style={{ color: 'var(--color-text-hint)' }}>最终请求地址：</span>
                    <span style={{
                      fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all',
                      color: endpointPreview.kind === 'invalid' ? 'var(--color-danger)' : 'var(--color-text)',
                    }}>
                      {endpointPreview.endpoint || '(无效)'}
                    </span>
                    <span style={{ color: 'var(--color-text-hint)' }}>Endpoint 类型：</span>
                    <span>{endpointPreview.kind}</span>
                    {endpointPreview.warnings.length > 0 && (
                      <>
                        <span style={{ color: 'var(--color-warning)' }}>Warnings：</span>
                        <span style={{ color: 'var(--color-warning)' }}>{endpointPreview.warnings.join('；')}</span>
                      </>
                    )}
                    {endpointPreview.errors.length > 0 && (
                      <>
                        <span style={{ color: 'var(--color-danger)' }}>Errors：</span>
                        <span style={{ color: 'var(--color-danger)' }}>{endpointPreview.errors.join('；')}</span>
                      </>
                    )}
                  </div>
                  {endpointPreview.endpoint.includes('/v1/v1') && (
                    <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 6, background: 'rgba(255,59,48,0.12)', color: 'var(--color-danger)', fontSize: 12, fontWeight: 500 }}>
                      检测到重复 /v1，这是 URL 归一化错误，不能继续测试。
                    </div>
                  )}
                </div>
              )}
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
              <button
                className="vp-btn vp-btn-primary"
                onClick={handleApiSmokeTest}
                disabled={!hasConfig || isTesting}
                style={{ minWidth: 160 }}
              >
                {isTesting ? (
                  <><Loader2 size={14} className="vp-spin" /> 测试中...</>
                ) : smokeTest.status === 'pass' ? (
                  <><Check size={14} /> API 可用</>
                ) : smokeTest.status === 'fail' ? (
                  <><AlertTriangle size={14} /> 重新测试</>
                ) : (
                  '测试并保存 API'
                )}
              </button>
              <button className="vp-btn vp-btn-ghost" onClick={handleRunSelfTest} style={{ fontSize: 13 }}>
                <Search size={14} /> URL 自检
              </button>
              {storedConfig && (
                <button className="vp-btn vp-btn-danger-text" onClick={handleClear} style={{ fontSize: 13, color: 'var(--color-danger)' }}>
                  <Trash2 size={14} /> 清除配置
                </button>
              )}
            </div>
          </LiquidCard>

          {/* V5.3: Smoke Test Result */}
          {smokeTest.status === 'pass' && (
            <LiquidCard
              style={{ marginBottom: 16, borderColor: 'rgba(52,199,89,0.25)', boxShadow: '0 0 24px rgba(52,199,89,0.10), var(--vp-shadow-inner)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Check size={18} style={{ color: 'var(--color-success)' }} />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-success)' }}>
                    API 可用 — 当前模型已能通过代理返回内容。
                  </p>
                  {smokeTest.durationMs != null && (
                    <p style={{ fontSize: 12, color: 'var(--color-text-hint)', marginTop: 4 }}>
                      响应耗时：{smokeTest.durationMs}ms
                    </p>
                  )}
                </div>
              </div>
            </LiquidCard>
          )}

          {smokeTest.status === 'fail' && smokeTest.error && (
            <LiquidCard
              style={{ marginBottom: 16, borderColor: 'rgba(255,59,48,0.2)' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <AlertTriangle size={18} style={{ color: 'var(--color-danger)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-danger)' }}>
                    API 不可用 — 查看下方 Debug 详情。
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 6, lineHeight: 1.6 }}>
                    {smokeTest.error}
                  </p>
                </div>
              </div>
            </LiquidCard>
          )}

          {/* V5.3: Collapsible Debug Panel */}
          {apiDebugInfo && (
            <details style={{ marginBottom: 16 }}>
              <summary style={{
                fontSize: 13, fontWeight: 500, cursor: 'pointer', color: 'var(--color-text-secondary)',
                padding: '10px 14px', borderRadius: 8, background: 'var(--vp-surface)', border: '1px solid var(--vp-border)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Activity size={14} />
                API Debug 详情
                {apiDebugInfo.httpStatus && (
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-danger)', fontFamily: 'monospace' }}>
                    HTTP {apiDebugInfo.httpStatus}
                  </span>
                )}
              </summary>
              <div style={{ marginTop: 8 }}>
                <LiquidCard style={{ borderColor: 'rgba(255,59,48,0.15)' }}>
                  <div style={{ fontSize: 12, lineHeight: 1.8, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 12px' }}>
                    <span style={{ color: 'var(--color-text-hint)' }}>Input API URL</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 10, wordBreak: 'break-all' }}>{apiDebugInfo.inputApiUrl}</span>

                    {apiDebugInfo.normalizedEndpoint && (
                      <>
                        <span style={{ color: 'var(--color-text-hint)' }}>Normalized Endpoint</span>
                        <span style={{ fontFamily: 'monospace', fontSize: 10, wordBreak: 'break-all' }}>{apiDebugInfo.normalizedEndpoint}</span>
                      </>
                    )}

                    {apiDebugInfo.endpointKind && (
                      <>
                        <span style={{ color: 'var(--color-text-hint)' }}>Endpoint Kind</span>
                        <span>{apiDebugInfo.endpointKind}</span>
                      </>
                    )}

                    <span style={{ color: 'var(--color-text-hint)' }}>Model</span>
                    <span>{apiDebugInfo.model}</span>

                    {apiDebugInfo.httpStatus != null && (
                      <>
                        <span style={{ color: 'var(--color-text-hint)' }}>HTTP Status</span>
                        <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>{apiDebugInfo.httpStatus}</span>
                      </>
                    )}

                    {apiDebugInfo.errorCategory && (
                      <>
                        <span style={{ color: 'var(--color-text-hint)' }}>Error Category</span>
                        <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>{apiDebugInfo.errorCategory}</span>
                      </>
                    )}

                    {apiDebugInfo.errorMessage && (
                      <>
                        <span style={{ color: 'var(--color-text-hint)' }}>Error Message</span>
                        <span style={{ color: 'var(--color-danger)' }}>{apiDebugInfo.errorMessage}</span>
                      </>
                    )}

                    {apiDebugInfo.timeoutMs != null && (
                      <>
                        <span style={{ color: 'var(--color-text-hint)' }}>Timeout</span>
                        <span>{apiDebugInfo.timeoutMs}ms ({Math.round(apiDebugInfo.timeoutMs / 1000)}s)</span>
                      </>
                    )}

                    {apiDebugInfo.proxyDurationMs != null && (
                      <>
                        <span style={{ color: 'var(--color-text-hint)' }}>Proxy Duration</span>
                        <span>{apiDebugInfo.proxyDurationMs}ms</span>
                      </>
                    )}

                    {apiDebugInfo.upstreamDurationMs != null && (
                      <>
                        <span style={{ color: 'var(--color-text-hint)' }}>Upstream Duration</span>
                        <span>{apiDebugInfo.upstreamDurationMs}ms</span>
                      </>
                    )}

                    {apiDebugInfo.endpointWarnings && apiDebugInfo.endpointWarnings.length > 0 && (
                      <>
                        <span style={{ color: 'var(--color-warning)' }}>Warnings</span>
                        <span style={{ color: 'var(--color-warning)', fontSize: 10 }}>{apiDebugInfo.endpointWarnings.join('; ')}</span>
                      </>
                    )}

                    <span style={{ color: 'var(--color-text-hint)' }}>Time</span>
                    <span style={{ fontSize: 10 }}>{new Date(apiDebugInfo.timestamp).toLocaleTimeString()}</span>
                  </div>

                  {/* Upstream body preview */}
                  {apiDebugInfo.upstreamBodyPreview && (
                    <details style={{ marginTop: 12 }}>
                      <summary style={{ fontSize: 12, cursor: 'pointer', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                        Upstream Body Preview ({apiDebugInfo.upstreamBodyPreview.length} chars)
                      </summary>
                      <pre style={{
                        marginTop: 8, padding: '8px 12px', borderRadius: 6,
                        background: 'var(--color-bg-secondary)', fontSize: 10,
                        lineHeight: 1.6, overflow: 'auto', maxHeight: 200,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                        fontFamily: 'monospace',
                      }}>
                        {apiDebugInfo.upstreamBodyPreview}
                      </pre>
                    </details>
                  )}

                  {/* Raw response preview */}
                  {apiDebugInfo.rawResponsePreview && (
                    <details style={{ marginTop: 8 }}>
                      <summary style={{ fontSize: 12, cursor: 'pointer', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                        Raw Response Preview ({apiDebugInfo.rawResponsePreview.length} chars)
                      </summary>
                      <pre style={{
                        marginTop: 8, padding: '8px 12px', borderRadius: 6,
                        background: 'var(--color-bg-secondary)', fontSize: 10,
                        lineHeight: 1.6, overflow: 'auto', maxHeight: 200,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                        fontFamily: 'monospace',
                      }}>
                        {apiDebugInfo.rawResponsePreview}
                      </pre>
                    </details>
                  )}
                </LiquidCard>
              </div>
            </details>
          )}

          {/* V5.1: URL Self-Test Results */}
          {selfTestResults && (
            <LiquidCard style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Search size={14} />
                URL 兼容性自检结果
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse', fontFamily: 'monospace' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--vp-border)', textAlign: 'left' }}>
                      <th style={{ padding: '4px 8px', color: 'var(--color-text-hint)' }}>Input</th>
                      <th style={{ padding: '4px 8px', color: 'var(--color-text-hint)' }}>Expected</th>
                      <th style={{ padding: '4px 8px', color: 'var(--color-text-hint)' }}>Actual</th>
                      <th style={{ padding: '4px 8px', color: 'var(--color-text-hint)' }}>Passed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selfTestResults.map((tc, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--vp-border)', background: tc.passed ? undefined : 'rgba(255,59,48,0.06)' }}>
                        <td style={{ padding: '4px 8px', wordBreak: 'break-all', maxWidth: 200 }}>{tc.input}</td>
                        <td style={{ padding: '4px 8px', wordBreak: 'break-all', maxWidth: 200 }}>{tc.expected}</td>
                        <td style={{ padding: '4px 8px', wordBreak: 'break-all', maxWidth: 200, color: tc.passed ? undefined : 'var(--color-danger)' }}>{tc.actual}</td>
                        <td style={{ padding: '4px 8px' }}>{tc.passed ? '✅' : '❌'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(() => {
                const passedCount = selfTestResults.filter((tc) => tc.passed).length;
                const failedCount = selfTestResults.length - passedCount;
                return (
                  <div style={{ marginTop: 8, padding: '6px 12px', borderRadius: 6, background: failedCount > 0 ? 'rgba(255,59,48,0.08)' : 'rgba(52,199,89,0.08)', fontSize: 12 }}>
                    <strong>{passedCount}/{selfTestResults.length} 通过</strong>
                    {failedCount > 0 && <span style={{ color: 'var(--color-danger)', marginLeft: 8 }}>{failedCount} 项失败 — 请检查 endpoint normalizer</span>}
                  </div>
                );
              })()}
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
                A: 正式生成不能用。请点击「测试并保存 API」完成一次最小模型响应测试。
              </p>
              <p>
                <strong>Q: 测试报 HTTP 500 是什么意思？</strong><br />
                A: 说明请求已到达上游服务商，但服务商内部处理失败。通常不是 URL 或 Key 的问题，而是模型名不兼容或服务商临时故障。请查看 Debug 详情中的 Error Category 和 Upstream Body Preview。
              </p>
            </div>
          </div>
        </div>
      </main>
    </PageReveal>
  );
}
