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
  runProviderSmokeTest,
  type ProviderSmokeAttempt,
} from '../api/providerSmokeTest';
import {
  clearAIRequestProfile,
  saveAIRequestProfileFromSmokeVariant,
} from '../api/aiRequestProfile';
import type { ProviderModelDiagnosis } from '../api/providerProfiles';
import type { ModelNameDiagnostics } from '../api/modelNameUtils';
import type { ModelListProbeResult } from '../api/modelListProbe';
import type { RequestBodyShape } from '../api/providerSmokeTest';
import { diagnoseProviderModelMismatch } from '../api/providerProfiles';
import { diagnoseModelName } from '../api/modelNameUtils';
import { PageReveal, LiquidCard, LiquidBadge } from '../components/liquid';
import ThemeToggle from '../components/ThemeToggle';

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
    name: 'MiMo / 小米',
    apiUrl: 'https://token-plan-cn.xiaomimo.com',
    model: '',
    docUrl: '',
    note: '请填写小米后台展示的精确 MiMo model id。不要填写 Kimi / Moonshot 模型名，除非该网关明确支持。',
  },
  {
    name: 'Kimi / Moonshot',
    apiUrl: '',
    model: '',
    docUrl: 'https://platform.moonshot.cn',
    note: '请填写 Moonshot / Kimi 官方 API 地址和后台展示的精确 model id。',
  },
  {
    name: 'StepFun / 阶跃星辰',
    apiUrl: 'https://api.stepfun.com/v1',
    model: 'step-3.7-flash',
    docUrl: 'https://platform.stepfun.com',
    note: 'StepFun 官方 OpenAI-compatible 接口。若测试返回 HTTP 500，请先确认 API Key 已开通当前模型，或从 /v1/models/控制台复制可见模型名。',
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
    note: '如果第三方网关同时代理多家模型，请以该网关后台显示的 endpoint 和 model id 为准。',
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

/** V5.6: API Debug Info with provider/model diagnostics */
interface ApiDebugInfo {
  testName: 'smoke_test'
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
  /** All smoke test attempts */
  attempts?: ProviderSmokeAttempt[]
  passedVariantId?: string
  overallOk?: boolean
  /** Upstream body samples for quick diagnosis */
  upstreamBodySamples?: Array<{ variantId: string; preview: string }>
  /** Provider/model mismatch diagnosis */
  providerDiagnosis?: ProviderModelDiagnosis
  /** Model name diagnostics */
  modelDiagnostics?: ModelNameDiagnostics
  /** Model list probe result */
  modelListProbe?: ModelListProbeResult
  /** Normalized model name */
  normalizedModel?: string
  /** V5.6: Request body shape diagnostics */
  requestBodyShape?: RequestBodyShape
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<AIConnectionStatus>(getAIConnectionStatus());

  // V5.6: savedConfig as state instead of reading localStorage on every render
  const [savedConfig, setSavedConfig] = useState(() => getAIConfig());

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
  const isTesting = smokeTest.status === 'running';

  const setStatus = (status: AIConnectionStatus) => {
    saveAIConnectionStatus(status);
    setConnectionStatus(status);
  };

  const markConfigChanged = (nextApiUrl: string, nextApiKey: string, nextModel: string) => {
    clearAIRequestProfile();
    setStatus(nextApiUrl.trim() && nextApiKey.trim() && nextModel.trim() ? 'failed' : 'unconfigured');
  };

  const resetAllTests = () => {
    setSmokeTest({ status: 'idle' });
    setApiDebugInfo(null);
  };

  // V5.6: Real-time provider/model mismatch preview
  const liveProviderDiag = apiUrl.trim() && model.trim()
    ? diagnoseProviderModelMismatch({ apiUrl, model: diagnoseModelName(model).normalized })
    : null;
  const liveModelDiag = model.trim() ? diagnoseModelName(model) : null;

  // ---- V5.6: Provider-Compatible Smoke Test ----
  const handleApiSmokeTest = async () => {
    if (!hasConfig) return;
    setSmokeTest({ status: 'running' });
    setApiDebugInfo(null);

    try {
      const result = await runProviderSmokeTest({
        apiUrl: normalizeApiUrl(apiUrl),
        apiKey: apiKey.trim(),
        model: model.trim(),
        timeoutMs: 30000,
      });

      // Build debug info from result
      const normalized = normalizeOpenAICompatibleEndpoint(apiUrl);
      setApiDebugInfo({
        testName: 'smoke_test',
        inputApiUrl: normalizeApiUrl(apiUrl),
        normalizedEndpoint: result.normalizedEndpoint || normalized.endpoint,
        endpointKind: result.endpointKind || normalized.kind,
        endpointWarnings: normalized.warnings,
        endpointErrors: normalized.errors,
        model: model.trim(),
        normalizedModel: result.normalizedModel,
        httpStatus: result.attempts[result.attempts.length - 1]?.httpStatus,
        errorCategory: result.attempts[result.attempts.length - 1]?.errorCategory,
        errorMessage: result.finalError,
        rawResponsePreview: result.attempts[result.attempts.length - 1]?.rawResponsePreview,
        timestamp: new Date().toISOString(),
        attempts: result.attempts,
        passedVariantId: result.passedVariantId,
        overallOk: result.ok,
        upstreamBodySamples: result.upstreamBodySamples?.map(s => ({ variantId: s.variantId, preview: s.preview })),
        providerDiagnosis: result.providerDiagnosis,
        modelDiagnostics: result.modelDiagnostics,
        modelListProbe: result.modelListProbe,
        requestBodyShape: result.requestBodyShape,
      });

      // V5.6: Use normalized model for saving
      const modelToSave = result.normalizedModel || model.trim();

      if (result.ok) {
        if (result.passedVariantId) {
          saveAIRequestProfileFromSmokeVariant(result.passedVariantId);
        }
        // SUCCESS
        setSmokeTest({ status: 'pass', durationMs: result.durationMs });
        const configToSave = { apiUrl: normalizeApiUrl(apiUrl), apiKey: apiKey.trim(), model: modelToSave };
        saveAIConfig(configToSave);
        setSavedConfig(configToSave);
        saveAIConnectionStatus('connected');
        markApiReady({
          model: modelToSave,
          apiUrl: normalizeApiUrl(apiUrl),
          tests: {
            smokeTest: {
              status: 'pass',
              durationMs: result.durationMs,
              checkedAt: new Date().toISOString(),
              variantId: result.passedVariantId,
            },
          },
        });
        setStatus('connected');
      } else {
        // FAILED
        setSmokeTest({ status: 'fail', durationMs: result.durationMs, error: result.finalError });
        const configToSave = { apiUrl: normalizeApiUrl(apiUrl), apiKey: apiKey.trim(), model: modelToSave };
        saveAIConfig(configToSave);
        setSavedConfig(configToSave);
        saveAIConnectionStatus('failed');
        markApiFailed('quick_ping_failed', result.finalError || 'API Smoke Test 失败');
        setStatus('failed');
      }
    } catch (err) {
      const errorMsg = `请求失败：${err instanceof Error ? err.message : String(err)}`;
      setSmokeTest({ status: 'fail', error: errorMsg });
      markApiFailed('quick_ping_failed', errorMsg);
      setStatus('failed');
    }
  };

  const handleClear = () => {
    clearAIConfig();
    clearApiHealth();
    setSavedConfig(null);
    setStatus('unconfigured');
    setApiUrl('');
    setApiKey('');
    setModel('');
    resetAllTests();
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setApiUrl(preset.apiUrl);
    setModel(preset.model);
    clearAIRequestProfile();
    markConfigChanged(preset.apiUrl, apiKey, preset.model);
  };

  // V5.1: Run endpoint normalizer self-test
  const handleRunSelfTest = () => {
    const results = runEndpointNormalizerSelfTest();
    setSelfTestResults(results);
  };

  const isApiReady = connectionStatus === 'connected' && smokeTest.status === 'pass';

  /**
   * V5.6: Build dynamic main error message with priority:
   * 1. Provider mismatch
   * 2. Model not found in list
   * 3. Auth/permission/quota
   * 4. All-500
   * 5. Generic
   */
  const getMainErrorHighlight = (): { title: string; detail: string; isMismatch: boolean } | null => {
    if (smokeTest.status !== 'fail' || !apiDebugInfo) return null;

    // Priority 1: Provider mismatch
    if (apiDebugInfo.providerDiagnosis && apiDebugInfo.providerDiagnosis.errors.length > 0) {
      return {
        title: 'API URL 与模型名疑似不匹配',
        detail: apiDebugInfo.providerDiagnosis.errors[0],
        isMismatch: true,
      };
    }

    // Priority 2: Model not found in list
    if (apiDebugInfo.modelListProbe?.ok && apiDebugInfo.modelListProbe.currentModelFound === false) {
      const similar = apiDebugInfo.modelListProbe.similarModels;
      return {
        title: '模型列表中未找到该模型名',
        detail: similar && similar.length > 0
          ? `相似模型：${similar.join('、')}。请从服务商后台复制精确 model id。`
          : '请从服务商后台复制精确 model id。',
        isMismatch: false,
      };
    }

    // Priority 3: Auth errors
    const authAttempt = apiDebugInfo.attempts?.find(a => a.errorCategory === 'auth_error' || a.errorCategory === 'permission_error');
    if (authAttempt) {
      return {
        title: 'API Key 或模型权限错误',
        detail: authAttempt.errorCategory === 'auth_error'
          ? 'API Key 无效或没有权限。请检查 Key 是否正确。'
          : 'API Key 无权限访问该模型。请在服务商后台确认权限。',
        isMismatch: false,
      };
    }

    // Priority 4: Quota
    const quotaAttempt = apiDebugInfo.attempts?.find(a => a.errorCategory === 'quota_or_rate_limit');
    if (quotaAttempt) {
      return {
        title: '额度不足或限流',
        detail: '请检查账户余额或稍后重试。',
        isMismatch: false,
      };
    }

    // Priority 5: All 500
    const all500 = apiDebugInfo.attempts?.every(a => a.httpStatus === 500 || a.errorCategory === 'provider_internal_error');
    if (all500 && apiDebugInfo.attempts && apiDebugInfo.attempts.length > 0) {
      return {
        title: '上游在最小请求下仍返回 HTTP 500',
        detail: apiDebugInfo.errorMessage || '大概率不是参数兼容性问题，而是模型名、权限、账户或服务商内部状态问题。',
        isMismatch: false,
      };
    }

    return null;
  };

  const mainError = getMainErrorHighlight();

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

          {/* Current status — V5.6: use savedConfig state */}
          {savedConfig ? (
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
                当前模型：<strong>{savedConfig.model}</strong>
                &nbsp;·&nbsp;
                {savedConfig.apiUrl}
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

          {/* V5.6: Live Provider/Model mismatch warning */}
          {liveProviderDiag && liveProviderDiag.errors.length > 0 && (
            <LiquidCard
              style={{ marginBottom: 16, borderColor: 'rgba(255,59,48,0.25)', background: 'rgba(255,59,48,0.04)' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <AlertTriangle size={16} style={{ color: 'var(--color-danger)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-danger)' }}>
                    强烈怀疑：API URL 与模型名不匹配
                  </p>
                  {liveProviderDiag.errors.map((err, i) => (
                    <p key={i} style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4, lineHeight: 1.6 }}>
                      {err}
                    </p>
                  ))}
                  {liveProviderDiag.suggestions.map((s, i) => (
                    <p key={i} style={{ fontSize: 12, color: 'var(--color-text-hint)', marginTop: 4 }}>
                      💡 {s}
                    </p>
                  ))}
                </div>
              </div>
            </LiquidCard>
          )}

          {/* V5.6: Live Model name diagnostics warning */}
          {liveModelDiag && liveModelDiag.changed && (
            <LiquidCard
              style={{ marginBottom: 16, borderColor: 'rgba(255,149,0,0.20)', background: 'rgba(255,149,0,0.04)' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <AlertTriangle size={16} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-warning)' }}>
                    模型名包含隐藏字符或特殊格式
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                    原始：{liveModelDiag.original} → 清洗后：{liveModelDiag.normalized}
                  </p>
                  {liveModelDiag.warnings.map((w, i) => (
                    <p key={i} style={{ fontSize: 11, color: 'var(--color-warning)', marginTop: 2 }}>
                      ⚡ {w}
                    </p>
                  ))}
                  <p style={{ fontSize: 11, color: 'var(--color-text-hint)', marginTop: 4 }}>
                    测试时将使用清洗后的模型名。
                  </p>
                </div>
              </div>
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
              {savedConfig && (
                <button className="vp-btn vp-btn-danger-text" onClick={handleClear} style={{ fontSize: 13, color: 'var(--color-danger)' }}>
                  <Trash2 size={14} /> 清除配置
                </button>
              )}
            </div>

            {/* Advanced Diagnostics (collapsed) */}
            <details style={{ marginTop: 12 }}>
              <summary style={{ fontSize: 12, cursor: 'pointer', color: 'var(--color-text-hint)' }}>
                高级诊断（URL 自检）
              </summary>
              <div style={{ marginTop: 8 }}>
                <button className="vp-btn vp-btn-ghost" onClick={handleRunSelfTest} style={{ fontSize: 12 }}>
                  运行 URL 兼容性自检
                </button>
              </div>
            </details>
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
                  {/* V5.6: Show provider warnings even when test passes */}
                  {apiDebugInfo?.providerDiagnosis?.warnings && apiDebugInfo.providerDiagnosis.warnings.length > 0 && (
                    <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(255,149,0,0.06)', fontSize: 12 }}>
                      {apiDebugInfo.providerDiagnosis.warnings.map((w, i) => (
                        <p key={i} style={{ color: 'var(--color-warning)', margin: '2px 0' }}>
                          ⚡ {w}
                        </p>
                      ))}
                    </div>
                  )}
                  {/* V5.6: Show model list probe success info */}
                  {apiDebugInfo?.modelListProbe?.ok && apiDebugInfo.modelListProbe.currentModelFound === true && (
                    <div style={{ marginTop: 4, fontSize: 11, color: 'var(--color-text-secondary)' }}>
                      ✅ 模型 "{apiDebugInfo.normalizedModel ?? apiDebugInfo.model}" 已在服务商模型列表中确认
                    </div>
                  )}
                </div>
              </div>
            </LiquidCard>
          )}

          {smokeTest.status === 'fail' && (
            <LiquidCard
              style={{ marginBottom: 16, borderColor: 'rgba(255,59,48,0.2)' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <AlertTriangle size={18} style={{ color: 'var(--color-danger)', flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  {/* V5.6: Dynamic error title with priority */}
                  {mainError ? (
                    <>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-danger)' }}>
                        {mainError.title}
                      </p>
                      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 6, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {mainError.detail}
                      </p>
                      {mainError.isMismatch && apiDebugInfo?.providerDiagnosis?.suggestions && (
                        <div style={{ marginTop: 8 }}>
                          {apiDebugInfo.providerDiagnosis.suggestions.map((s, i) => (
                            <p key={i} style={{ fontSize: 12, color: 'var(--color-text-hint)', marginTop: 2 }}>
                              💡 {s}
                            </p>
                          ))}
                        </div>
                      )}
                      {/* Show model list probe info inline if available */}
                      {apiDebugInfo?.modelListProbe?.ok && apiDebugInfo.modelListProbe.currentModelFound === false && !mainError.isMismatch && (
                        <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(255,59,48,0.06)', fontSize: 12 }}>
                          <span style={{ color: 'var(--color-danger)' }}>
                            ⚠️ 模型列表中未找到 "{apiDebugInfo.normalizedModel ?? apiDebugInfo.model}"
                          </span>
                          {apiDebugInfo.modelListProbe.similarModels && apiDebugInfo.modelListProbe.similarModels.length > 0 && (
                            <div style={{ color: 'var(--color-text-secondary)', marginTop: 4 }}>
                              相似模型：{apiDebugInfo.modelListProbe.similarModels.join('、')}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-danger)' }}>
                        API 不可用
                      </p>
                      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 6, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {smokeTest.error}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </LiquidCard>
          )}

          {/* V5.6: Collapsible Debug Panel with Attempts */}
          {apiDebugInfo && (
            <details style={{ marginBottom: 16 }}>
              <summary style={{
                fontSize: 13, fontWeight: 500, cursor: 'pointer', color: 'var(--color-text-secondary)',
                padding: '10px 14px', borderRadius: 8, background: 'var(--vp-surface)', border: '1px solid var(--vp-border)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Activity size={14} />
                API Debug — Smoke Test
                {apiDebugInfo.overallOk ? (
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-success)', fontFamily: 'monospace' }}>
                    PASSED ({apiDebugInfo.passedVariantId})
                  </span>
                ) : apiDebugInfo.httpStatus ? (
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-danger)', fontFamily: 'monospace' }}>
                    FAILED (HTTP {apiDebugInfo.httpStatus})
                  </span>
                ) : null}
              </summary>
              <div style={{ marginTop: 8 }}>
                <LiquidCard style={{ borderColor: apiDebugInfo.overallOk ? 'rgba(52,199,89,0.15)' : 'rgba(255,59,48,0.15)' }}>
                  {/* Basic info */}
                  <div style={{ fontSize: 12, lineHeight: 1.8, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 12px', marginBottom: 16 }}>
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

                    {apiDebugInfo.normalizedModel && apiDebugInfo.normalizedModel !== apiDebugInfo.model && (
                      <>
                        <span style={{ color: 'var(--color-warning)' }}>Normalized Model</span>
                        <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>{apiDebugInfo.normalizedModel}</span>
                      </>
                    )}

                    <span style={{ color: 'var(--color-text-hint)' }}>Overall Result</span>
                    <span style={{ color: apiDebugInfo.overallOk ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600 }}>
                      {apiDebugInfo.overallOk ? `PASSED (${apiDebugInfo.passedVariantId})` : 'FAILED'}
                    </span>

                    {apiDebugInfo.endpointWarnings && apiDebugInfo.endpointWarnings.length > 0 && (
                      <>
                        <span style={{ color: 'var(--color-warning)' }}>Warnings</span>
                        <span style={{ color: 'var(--color-warning)', fontSize: 10 }}>{apiDebugInfo.endpointWarnings.join('; ')}</span>
                      </>
                    )}

                    <span style={{ color: 'var(--color-text-hint)' }}>Time</span>
                    <span style={{ fontSize: 10 }}>{new Date(apiDebugInfo.timestamp).toLocaleTimeString()}</span>
                  </div>

                  {/* V5.6: Provider Diagnosis — always show if available */}
                  {apiDebugInfo.providerDiagnosis && (
                    <div style={{
                      marginBottom: 16, padding: '10px 14px', borderRadius: 6,
                      background: apiDebugInfo.providerDiagnosis.errors.length > 0
                        ? 'rgba(255,59,48,0.08)'
                        : 'var(--color-bg-secondary)',
                      border: `1px solid ${apiDebugInfo.providerDiagnosis.errors.length > 0 ? 'rgba(255,59,48,0.2)' : 'var(--vp-border)'}`,
                    }}>
                      <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {apiDebugInfo.providerDiagnosis.errors.length > 0 ? (
                          <AlertTriangle size={12} style={{ color: 'var(--color-danger)' }} />
                        ) : (
                          <Activity size={12} style={{ color: 'var(--color-text-hint)' }} />
                        )}
                        Provider 诊断
                        <span style={{ fontWeight: 400, color: 'var(--color-text-hint)', fontSize: 11 }}>
                          {apiDebugInfo.providerDiagnosis.providerLabel} (confidence: {Math.round(apiDebugInfo.providerDiagnosis.confidence * 100)}%)
                        </span>
                      </h4>
                      {apiDebugInfo.providerDiagnosis.errors.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          {apiDebugInfo.providerDiagnosis.errors.map((err, i) => (
                            <p key={i} style={{ fontSize: 12, color: 'var(--color-danger)', lineHeight: 1.6, margin: '4px 0' }}>
                              ⚠️ {err}
                            </p>
                          ))}
                        </div>
                      )}
                      {apiDebugInfo.providerDiagnosis.warnings.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          {apiDebugInfo.providerDiagnosis.warnings.map((w, i) => (
                            <p key={i} style={{ fontSize: 12, color: 'var(--color-warning)', lineHeight: 1.6, margin: '4px 0' }}>
                              ⚡ {w}
                            </p>
                          ))}
                        </div>
                      )}
                      {apiDebugInfo.providerDiagnosis.suggestions.length > 0 && (
                        <div>
                          {apiDebugInfo.providerDiagnosis.suggestions.map((s, i) => (
                            <p key={i} style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: '4px 0' }}>
                              💡 {s}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* V5.6: Model Name Diagnostics — always show if available */}
                  {apiDebugInfo.modelDiagnostics && (
                    <div style={{
                      marginBottom: 16, padding: '10px 14px', borderRadius: 6,
                      background: apiDebugInfo.modelDiagnostics.changed ? 'rgba(255,149,0,0.06)' : 'var(--color-bg-secondary)',
                      border: `1px solid ${apiDebugInfo.modelDiagnostics.changed ? 'rgba(255,149,0,0.15)' : 'var(--vp-border)'}`,
                    }}>
                      <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {apiDebugInfo.modelDiagnostics.changed ? (
                          <AlertTriangle size={12} style={{ color: 'var(--color-warning)' }} />
                        ) : (
                          <Check size={12} style={{ color: 'var(--color-success)' }} />
                        )}
                        模型名诊断
                      </h4>
                      <div style={{ fontSize: 11, lineHeight: 1.8, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 12px' }}>
                        <span style={{ color: 'var(--color-text-hint)' }}>Original</span>
                        <span style={{ fontFamily: 'monospace' }}>{apiDebugInfo.modelDiagnostics.original}</span>
                        <span style={{ color: 'var(--color-text-hint)' }}>Normalized</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{apiDebugInfo.modelDiagnostics.normalized}</span>
                        <span style={{ color: 'var(--color-text-hint)' }}>Changed</span>
                        <span>{apiDebugInfo.modelDiagnostics.changed ? '是' : '否'}</span>
                      </div>
                      {apiDebugInfo.modelDiagnostics.warnings.map((w, i) => (
                        <p key={i} style={{ fontSize: 11, color: 'var(--color-warning)', marginTop: 4 }}>
                          ⚡ {w}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* V5.6: Model List Probe */}
                  {apiDebugInfo.modelListProbe && (
                    <div style={{
                      marginBottom: 16, padding: '10px 14px', borderRadius: 6,
                      background: apiDebugInfo.modelListProbe.ok ? 'var(--color-bg-secondary)' : 'rgba(255,59,48,0.06)',
                      border: `1px solid ${apiDebugInfo.modelListProbe.ok ? 'var(--vp-border)' : 'rgba(255,59,48,0.15)'}`,
                    }}>
                      <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Search size={12} style={{ color: 'var(--color-text-hint)' }} />
                        模型列表探测 (/v1/models)
                      </h4>
                      {apiDebugInfo.modelListProbe.ok ? (
                        <div style={{ fontSize: 11, lineHeight: 1.8 }}>
                          <div>✅ 探测成功 — 返回 {apiDebugInfo.modelListProbe.models.length} 个模型</div>
                          <div style={{ fontSize: 10, color: 'var(--color-text-hint)' }}>
                            Endpoint: {apiDebugInfo.modelListProbe.endpoint}
                          </div>
                          {/* V5.6: Use probe result's currentModelFound */}
                          {(() => {
                            const normalizedModel = apiDebugInfo.normalizedModel ?? apiDebugInfo.model;
                            if (apiDebugInfo.modelListProbe.currentModelFound === false) {
                              return (
                                <div style={{ marginTop: 6 }}>
                                  <span style={{ color: 'var(--color-danger)' }}>
                                    ⚠️ 模型列表中未找到 "{normalizedModel}"
                                  </span>
                                  {apiDebugInfo.modelListProbe.similarModels && apiDebugInfo.modelListProbe.similarModels.length > 0 && (
                                    <div style={{ marginTop: 4, color: 'var(--color-text-secondary)' }}>
                                      相似模型：{apiDebugInfo.modelListProbe.similarModels.join('、')}
                                    </div>
                                  )}
                                </div>
                              );
                            } else if (apiDebugInfo.modelListProbe.currentModelFound === true) {
                              return <div style={{ marginTop: 4, color: 'var(--color-success)' }}>✅ 模型 "{normalizedModel}" 在列表中</div>;
                            } else {
                              // Fallback: check manually
                              const found = apiDebugInfo.modelListProbe.models.some(m => m.toLowerCase() === normalizedModel.toLowerCase());
                              if (!found) {
                                const similar = apiDebugInfo.modelListProbe.models
                                  .filter(m => {
                                    const ml = m.toLowerCase();
                                    const tl = normalizedModel.toLowerCase();
                                    return ml.includes(tl) || tl.includes(ml);
                                  })
                                  .slice(0, 5);
                                return (
                                  <div style={{ marginTop: 6 }}>
                                    <span style={{ color: 'var(--color-danger)' }}>
                                      ⚠️ 模型列表中未找到 "{normalizedModel}"
                                    </span>
                                    {similar.length > 0 && (
                                      <div style={{ marginTop: 4, color: 'var(--color-text-secondary)' }}>
                                        相似模型：{similar.join('、')}
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              return <div style={{ marginTop: 4, color: 'var(--color-success)' }}>✅ 模型 "{normalizedModel}" 在列表中</div>;
                            }
                          })()}
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, lineHeight: 1.6 }}>
                          <div style={{ color: 'var(--color-text-secondary)' }}>
                            ❌ 探测失败：{apiDebugInfo.modelListProbe.errorMessage ?? '不支持 /v1/models'}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--color-text-hint)', marginTop: 4 }}>
                            部分服务商不支持 /v1/models，不影响 Smoke Test 判断。
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* V5.6: Request Body Shape */}
                  {apiDebugInfo.requestBodyShape && (
                    <div style={{
                      marginBottom: 16, padding: '10px 14px', borderRadius: 6,
                      background: 'var(--color-bg-secondary)', border: '1px solid var(--vp-border)',
                    }}>
                      <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Activity size={12} style={{ color: 'var(--color-text-hint)' }} />
                        请求结构
                      </h4>
                      <div style={{ fontSize: 11, lineHeight: 1.8, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 12px' }}>
                        <span style={{ color: 'var(--color-text-hint)' }}>Model</span>
                        <span style={{ fontFamily: 'monospace' }}>{apiDebugInfo.requestBodyShape.model}</span>
                        <span style={{ color: 'var(--color-text-hint)' }}>Messages</span>
                        <span>{apiDebugInfo.requestBodyShape.messageCount}</span>
                        <span style={{ color: 'var(--color-text-hint)' }}>Roles</span>
                        <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{apiDebugInfo.requestBodyShape.roles.join(', ') || '-'}</span>
                        <span style={{ color: 'var(--color-text-hint)' }}>System Role</span>
                        <span>{apiDebugInfo.requestBodyShape.hasSystemRole ? '是' : '否'}</span>
                        <span style={{ color: 'var(--color-text-hint)' }}>Temperature</span>
                        <span>{apiDebugInfo.requestBodyShape.hasTemperature ? '是' : '否'}</span>
                        <span style={{ color: 'var(--color-text-hint)' }}>Max Tokens</span>
                        <span>{apiDebugInfo.requestBodyShape.hasMaxTokens ? '是' : '否'}</span>
                        <span style={{ color: 'var(--color-text-hint)' }}>Stream</span>
                        <span>{apiDebugInfo.requestBodyShape.hasStreamField ? '是' : '否'}</span>
                        <span style={{ color: 'var(--color-text-hint)' }}>Top Keys</span>
                        <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{apiDebugInfo.requestBodyShape.topLevelKeys.join(', ')}</span>
                      </div>
                    </div>
                  )}

                  {/* Upstream Response Body — visible at a glance */}
                  {!apiDebugInfo.overallOk && apiDebugInfo.attempts && apiDebugInfo.attempts.length > 0 && (() => {
                    const firstWithBody = apiDebugInfo.attempts.find(a => a.rawResponsePreview);
                    const distinctSamples = apiDebugInfo.upstreamBodySamples
                      ? Array.from(new Map(apiDebugInfo.upstreamBodySamples.map(s => [s.preview.slice(0, 500), s])).values())
                      : [];
                    return (
                    <div style={{
                      marginBottom: 16, padding: '10px 14px', borderRadius: 6,
                      background: 'var(--color-bg-secondary)', border: '1px solid rgba(255,59,48,0.15)',
                    }}>
                      <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlertTriangle size={12} />
                        上游原始响应
                      </h4>
                      {distinctSamples.length > 0 ? (
                        distinctSamples.map((sample, idx) => (
                          <details key={sample.variantId} open={idx === 0} style={{ marginBottom: idx < distinctSamples.length - 1 ? 8 : 0 }}>
                            <summary style={{ fontSize: 10, cursor: 'pointer', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                              {sample.variantId}
                            </summary>
                            <pre style={{
                              marginTop: 4, padding: '8px 10px', borderRadius: 4,
                              background: 'rgba(0,0,0,0.04)', fontSize: 10,
                              lineHeight: 1.5, overflow: 'auto', maxHeight: 200,
                              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                              color: 'var(--color-text-primary)',
                            }}>
                              {sample.preview}
                            </pre>
                          </details>
                        ))
                      ) : firstWithBody ? (
                        <pre style={{
                          margin: 0, padding: '8px 10px', borderRadius: 4,
                          background: 'rgba(0,0,0,0.04)', fontSize: 10,
                          lineHeight: 1.5, overflow: 'auto', maxHeight: 240,
                          whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                          color: 'var(--color-text-primary)',
                        }}>
                          {firstWithBody.rawResponsePreview}
                        </pre>
                      ) : (
                        <div style={{ fontSize: 11, color: 'var(--color-text-hint)' }}>
                          HTTP {apiDebugInfo.attempts[0]?.httpStatus || '?'} — {apiDebugInfo.attempts[0]?.errorCategory || '未知错误'}
                          {apiDebugInfo.attempts[0]?.errorMessage && (
                            <div style={{ marginTop: 4, color: 'var(--color-text-secondary)' }}>
                              {apiDebugInfo.attempts[0].errorMessage}
                            </div>
                          )}
                        </div>
                      )}
                      <div style={{ marginTop: 8, fontSize: 10, color: 'var(--color-text-hint)' }}>
                        在上游原始响应中查找模型名、权限、额度、参数格式等错误原因。
                        如果响应仅有 HTTP 500 且无 body，说明请求格式或模型名不被接受。
                      </div>
                    </div>
                    );
                  })()}

                  {/* Attempts table */}
                  {apiDebugInfo.attempts && apiDebugInfo.attempts.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: 12, fontWeight: 500, marginBottom: 8, color: 'var(--color-text-secondary)' }}>
                        Attempts ({apiDebugInfo.attempts.length})
                      </h4>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse', fontFamily: 'monospace' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--vp-border)', textAlign: 'left' }}>
                              <th style={{ padding: '4px 8px', color: 'var(--color-text-hint)' }}>Variant</th>
                              <th style={{ padding: '4px 8px', color: 'var(--color-text-hint)' }}>Status</th>
                              <th style={{ padding: '4px 8px', color: 'var(--color-text-hint)' }}>HTTP</th>
                              <th style={{ padding: '4px 8px', color: 'var(--color-text-hint)' }}>Error Category</th>
                              <th style={{ padding: '4px 8px', color: 'var(--color-text-hint)' }}>Duration</th>
                              <th style={{ padding: '4px 8px', color: 'var(--color-text-hint)' }}>Preview</th>
                            </tr>
                          </thead>
                          <tbody>
                            {apiDebugInfo.attempts.map((attempt, i) => (
                              <tr
                                key={i}
                                style={{
                                  borderBottom: '1px solid var(--vp-border)',
                                  background: attempt.ok ? 'rgba(52,199,89,0.06)' : undefined,
                                }}
                              >
                                <td style={{ padding: '4px 8px', maxWidth: 120 }}>
                                  <div style={{ fontWeight: 500 }}>{attempt.variantId}</div>
                                  <div style={{ fontSize: 10, color: 'var(--color-text-hint)' }}>{attempt.label}</div>
                                </td>
                                <td style={{ padding: '4px 8px' }}>
                                  {attempt.ok ? '✅' : '❌'}
                                </td>
                                <td style={{ padding: '4px 8px', color: attempt.httpStatus && attempt.httpStatus >= 400 ? 'var(--color-danger)' : undefined }}>
                                  {attempt.httpStatus || '-'}
                                </td>
                                <td style={{ padding: '4px 8px', fontSize: 10, color: attempt.errorCategory ? 'var(--color-danger)' : undefined }}>
                                  {attempt.errorCategory || '-'}
                                </td>
                                <td style={{ padding: '4px 8px' }}>
                                  {attempt.durationMs}ms
                                </td>
                                <td style={{ padding: '4px 8px', maxWidth: 200 }}>
                                  {attempt.contentPreview ? (
                                    <span style={{ color: 'var(--color-success)', fontSize: 10 }}>{attempt.contentPreview}</span>
                                  ) : attempt.rawResponsePreview ? (
                                    <details>
                                      <summary style={{ fontSize: 10, cursor: 'pointer' }}>
                                        {attempt.rawResponsePreview.length} chars
                                      </summary>
                                      <pre style={{
                                        marginTop: 4, padding: '4px 8px', borderRadius: 4,
                                        background: 'var(--color-bg-secondary)', fontSize: 9,
                                        lineHeight: 1.4, overflow: 'auto', maxHeight: 120,
                                        whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                                        fontFamily: 'monospace',
                                      }}>
                                        {attempt.rawResponsePreview}
                                      </pre>
                                    </details>
                                  ) : attempt.errorMessage ? (
                                    <span style={{ color: 'var(--color-danger)', fontSize: 10 }}>{attempt.errorMessage}</span>
                                  ) : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Final error message */}
                  {apiDebugInfo.errorMessage && (
                    <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 6, background: 'rgba(255,59,48,0.08)', fontSize: 12, lineHeight: 1.6 }}>
                      <strong style={{ color: 'var(--color-danger)' }}>最终错误：</strong>
                      <p style={{ marginTop: 4, color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap' }}>
                        {apiDebugInfo.errorMessage}
                      </p>
                    </div>
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
                A: 说明请求已到达上游服务商，但服务商内部处理失败。很多服务商会把模型名错误、权限不足包装成 HTTP 500。请查看 Debug 面板中的 Provider 诊断和模型列表探测。
              </p>
            </div>
          </div>
        </div>
      </main>
    </PageReveal>
  );
}
