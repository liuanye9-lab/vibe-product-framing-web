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

export default function SettingsPage() {
  const navigate = useNavigate();
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [longTestResult, setLongTestResult] = useState<{
    apiConnection?: boolean;
    jsonGeneration?: boolean;
    requiredFields?: {
      passed: boolean;
      missingFields: string[];
      msg: string;
    };
    refValidation?: {
      passed: boolean;
      msg: string;
    };
  } | null>(null);
  const [testingLong, setTestingLong] = useState(false);
  const [saved, setSaved] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<AIConnectionStatus>(getAIConnectionStatus());

  useEffect(() => {
    const config = getAIConfig();
    if (config) {
      setApiUrl(config.apiUrl);
      setApiKey(config.apiKey);
      setModel(config.model);
    }
  }, []);

  const hasConfig = apiUrl.trim() && apiKey.trim() && model.trim();
  const storedConfig = getAIConfig();

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
    clearAICache(); // Clear cached AI responses when config changes
    setStatus('failed');
    setSaved(true);
    setTestResult(null);
    setLongTestResult(null);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    if (!hasConfig) return;
    setTesting(true);
    setTestResult(null);

    try {
      const normalizedApiUrl = normalizeApiUrl(apiUrl);
      setApiUrl(normalizedApiUrl);
      const signal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(105000)
        : undefined;

      const response = await fetch('/api/ai-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal,
        body: JSON.stringify({
          apiUrl: normalizedApiUrl,
          apiKey: apiKey.trim(),
          timeoutMs: 90000,
          body: {
            model: model.trim(),
            messages: [
              {
                role: 'system',
                content: '你是 API 连通性测试器。只返回 JSON，不要 Markdown。',
              },
              {
                role: 'user',
                content: '请返回 {"ok":true,"message":"连接成功"}，不要输出其他内容。',
              },
            ],
            max_tokens: 120,
            temperature: 0,
          },
        }),
      });

      const rawText = await response.text();
      console.log('[VibePilot] Test connection raw response:', rawText.slice(0, 500));

      if (!response.ok) {
        let errMsg = `请求失败 (${response.status})`;
        try {
          const errJson = JSON.parse(rawText);
          errMsg = errJson.error?.message || errJson.error || errMsg;
        } catch {
          errMsg = rawText.slice(0, 300) || errMsg;
        }
        setTestResult({ ok: false, msg: String(errMsg) });
        saveAIConfig({ apiUrl: normalizedApiUrl, apiKey: apiKey.trim(), model: model.trim() });
        setStatus('failed');
        return;
      }

      let data: Record<string, unknown>;
      try {
        data = JSON.parse(rawText);
      } catch {
        setTestResult({ ok: false, msg: 'API 返回的不是有效 JSON，请检查 API 地址是否正确。' });
        saveAIConfig({ apiUrl: normalizedApiUrl, apiKey: apiKey.trim(), model: model.trim() });
        setStatus('failed');
        return;
      }

      const content = extractAIContent(data);

      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          saveAIConfig({ apiUrl: normalizedApiUrl, apiKey: apiKey.trim(), model: model.trim() });
          setStatus('failed');
          setTestResult({ ok: false, msg: `模型已响应，但没有按 JSON 格式返回。实际返回：${content.slice(0, 120)}` });
          return;
        }
        saveAIConfig({ apiUrl: normalizedApiUrl, apiKey: apiKey.trim(), model: model.trim() });
        setStatus('connected');
        setTestResult({ ok: true, msg: `连接成功！模型可正常返回生成内容：${content.slice(0, 80)}` });
      } else {
        console.log('[VibePilot] Test connection - no content found in:', data);
        saveAIConfig({ apiUrl: normalizedApiUrl, apiKey: apiKey.trim(), model: model.trim() });
        setStatus('failed');
        setTestResult({ ok: false, msg: '模型返回为空，请检查模型名称是否正确。响应结构：' + Object.keys(data).join(', ') });
      }
    } catch (err) {
      if (hasConfig) {
        saveAIConfig({ apiUrl: normalizeApiUrl(apiUrl), apiKey: apiKey.trim(), model: model.trim() });
      }
      setStatus('failed');
      const errorName = err && typeof err === 'object' && 'name' in err ? String((err as { name?: unknown }).name) : '';
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isTimeout = errorName === 'TimeoutError' || /timeout|timed out|超时|aborted|abort/i.test(errorMessage);
      setTestResult({
        ok: false,
        msg: isTimeout
          ? '测试连接超时：模型响应较慢或 API 地址不可达。请确认地址、模型名和服务商状态。'
          : err instanceof TypeError ? '网络请求失败，请检查 API 地址是否正确。' : `未知错误：${String(err)}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleLongTest = async () => {
    if (!hasConfig) return;
    setTestingLong(true);
    setLongTestResult(null);

    const result: NonNullable<typeof longTestResult> = {};

    try {
      const signal = AbortSignal.timeout?.(150000) || undefined;

      const response = await fetch('/api/ai-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          apiUrl: normalizeApiUrl(apiUrl),
          apiKey: apiKey.trim(),
          timeoutMs: 120000,
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
            max_tokens: 1200,
            temperature: 0,
          },
        }),
      });

      // Layer 1: API Connection
      result.apiConnection = response.ok;

      if (!response.ok) {
        setLongTestResult({
          apiConnection: false,
          jsonGeneration: false,
          requiredFields: { passed: false, missingFields: ['N/A'], msg: `API 请求失败 (${response.status})` },
          refValidation: { passed: false, msg: 'API 连接失败，无法校验。' },
        });
        return;
      }

      const rawText = await response.text();
      let data: Record<string, unknown>;
      try { data = JSON.parse(rawText); } catch {
        setLongTestResult({
          apiConnection: true,
          jsonGeneration: false,
          requiredFields: { passed: false, missingFields: ['N/A'], msg: '代理返回的不是有效 JSON' },
          refValidation: { passed: false, msg: '代理响应格式错误。' },
        });
        return;
      }

      const content = extractAIContent(data);
      if (!content) {
        setLongTestResult({
          apiConnection: true,
          jsonGeneration: false,
          requiredFields: { passed: false, missingFields: ['N/A'], msg: '模型返回为空' },
          refValidation: { passed: false, msg: '模型无响应内容。' },
        });
        return;
      }

      console.log('[VibePilot] Long JSON test content:', content.slice(0, 800));

      // Layer 2: JSON Parse — reuse extractJson from evaluate.ts
      const parsed = extractJson<Record<string, unknown>>(content);
      if (!parsed) {
        setLongTestResult({
          apiConnection: true,
          jsonGeneration: false,
          requiredFields: { passed: false, missingFields: ['N/A'], msg: '模型返回无法解析为 JSON' },
          refValidation: { passed: false, msg: `JSON 解析失败。原始内容：${content.slice(0, 160)}` },
        });
        return;
      }

      result.jsonGeneration = true;
      console.log('[VibePilot] Long JSON parsed:', JSON.stringify(parsed).slice(0, 500));

      // Layer 3: Required Fields check
      const fieldChecks = {
        referenceEvidence: parsed.referenceEvidence && typeof parsed.referenceEvidence === 'object',
        productBrief: isUsefulString(parsed.productBrief, 20),
        mvpScope: isUsefulString(parsed.mvpScope, 20),
        devSpec: isUsefulString(parsed.devSpec, 20),
        developmentPrompt: isUsefulString(parsed.developmentPrompt, 20),
      };

      console.log('[VibePilot] Long JSON fieldChecks:', fieldChecks);

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
          requiredFields: {
            passed: false,
            missingFields,
            msg: `关键字段质量不足：${missingFields.join(', ')}。${hint}`,
          },
          refValidation: { passed: false, msg: '字段不足，无法校验内容相关性。' },
        });
        return;
      }

      result.requiredFields = { passed: true, missingFields: [], msg: '全部关键字段可用。' };

      // Layer 4: Reference Validation — reuse validateAIOutputReferencesInput
      const validation = validateAIOutputReferencesInput(LONG_TEST_BRIEF, parsed);
      console.log('[VibePilot] Long JSON validation:', validation);

      result.refValidation = {
        passed: validation.passed,
        msg: validation.passed ? `通过：${validation.reason}` : `相关性不足：${validation.reason}`,
      };

      setLongTestResult(result);
      saveAIConfig({ apiUrl: normalizeApiUrl(apiUrl), apiKey: apiKey.trim(), model: model.trim() });
      setStatus('connected');
    } catch (err) {
      const isTimeout = err && typeof err === 'object' && 'name' in err && (err as { name?: string }).name === 'TimeoutError';
      setLongTestResult({
        apiConnection: false,
        jsonGeneration: false,
        requiredFields: { passed: false, missingFields: [], msg: '' },
        refValidation: { passed: false, msg: isTimeout ? '长 JSON 生成超时（>120s），建议换更快模型' : `错误：${err instanceof Error ? err.message : String(err)}` },
      });
    } finally {
      setTestingLong(false);
    }
  };

  const handleClear = () => {
    clearAIConfig();
    setStatus('unconfigured');
    setApiUrl('');
    setApiKey('');
    setModel('');
    setTestResult(null);
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setApiUrl(preset.apiUrl);
    setModel(preset.model);
    markConfigChanged(preset.apiUrl, apiKey, preset.model);
  };

  return (
    <div className="vp-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="vp-header">
        <div style={{ maxWidth: 640, margin: '0 auto', width: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="vp-btn-text" onClick={() => navigate('/')} style={{ padding: '4px 6px' }} title="返回主页">
            <Home size={18} />
          </button>
          <Brain size={16} style={{ color: 'var(--color-primary)' }} />
          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>VibePilot</span>
          <span style={{ color: 'var(--color-text-hint)' }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 500 }}>AI 设置</span>
        </div>
      </header>

      <main style={{ flex: 1, padding: '2rem' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {/* Intro */}
          <div style={{ marginBottom: 32 }}>
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
            <div
              className="vp-card"
              style={{
                marginBottom: 24,
                borderColor: 'rgba(18,18,18,0.14)',
                background: 'var(--color-success-light)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Zap size={16} style={{ color: 'var(--color-success)' }} />
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-success)' }}>
                  {connectionStatus === 'connected' ? 'AI 模型已连接成功' : 'AI 模型已配置，尚未测试成功'}
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                当前模型：<strong>{storedConfig.model}</strong>
                &nbsp;·&nbsp;
                {storedConfig.apiUrl}
              </p>
              {connectionStatus !== 'connected' && (
                <p style={{ fontSize: 12, color: 'var(--color-warning)', lineHeight: 1.6, marginTop: 6 }}>
                  保存配置不等于连接成功。请点击“测试连接”，成功后才能生成 AI 分析。
                </p>
              )}
            </div>
          ) : (
            <div
              className="vp-card"
              style={{
                marginBottom: 24,
                borderColor: 'rgba(18,18,18,0.14)',
                background: 'var(--color-warning-light)',
              }}
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
            </div>
          )}

          {/* Presets */}
          <div className="vp-card" style={{ marginBottom: 16 }}>
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
          </div>

          {/* Config form */}
          <div className="vp-card" style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                API 地址
              </label>
              <input
                className="vp-textarea"
                style={{ fontFamily: 'monospace', fontSize: 13, padding: '10px 14px' }}
                value={apiUrl}
                onChange={(e) => {
                  setApiUrl(e.target.value);
                  markConfigChanged(e.target.value, apiKey, model);
                }}
                placeholder="https://api.openai.com"
              />
              <p style={{ fontSize: 12, color: 'var(--color-text-hint)', marginTop: 4 }}>
                如果你的服务商不是 OpenAI-compatible，请填写完整 endpoint，例如以 /chat/completions 结尾。支持如 https://api.openai.com/v1/chat/completions
              </p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                API Key
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  className="vp-textarea"
                  type={showKey ? 'text' : 'password'}
                  style={{ fontFamily: 'monospace', fontSize: 13, padding: '10px 14px', paddingRight: 40 }}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    markConfigChanged(apiUrl, e.target.value, model);
                  }}
                  placeholder="sk-..."
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text-hint)',
                    padding: 4,
                  }}
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p style={{ fontSize: 12, color: 'var(--color-text-hint)', marginTop: 4 }}>
                仅存储在浏览器 localStorage，不会上传
              </p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                模型名称
              </label>
              <input
                className="vp-textarea"
                style={{ fontFamily: 'monospace', fontSize: 13, padding: '10px 14px' }}
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  markConfigChanged(apiUrl, apiKey, e.target.value);
                }}
                placeholder="gpt-4o"
              />
              <p style={{ fontSize: 12, color: 'var(--color-text-hint)', marginTop: 4 }}>
                API 支持的具体模型名称
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="vp-btn vp-btn-primary"
                onClick={handleSave}
                disabled={!hasConfig || saved}
              >
                {saved ? <><Check size={14} /> 已保存</> : '保存配置'}
              </button>
              <button
                className="vp-btn vp-btn-ghost"
                onClick={handleTest}
                disabled={!hasConfig || testing}
              >
                {testing ? <><Loader2 size={14} className="vp-spin" /> 测试中...</> : '测试连接（短）'}
              </button>
              <button
                className="vp-btn vp-btn-ghost"
                onClick={handleLongTest}
                disabled={!hasConfig || testingLong}
              >
                {testingLong ? <><Loader2 size={14} className="vp-spin" /> 测试中...</> : '测试长 JSON 生成'}
              </button>
              {storedConfig && (
                <button
                  className="vp-btn vp-btn-danger-text"
                  onClick={handleClear}
                  style={{ fontSize: 13, color: 'var(--color-danger)' }}
                >
                  <Trash2 size={14} />
                  清除配置
                </button>
              )}
            </div>
          </div>

          {/* Long JSON test result */}
          {longTestResult && (
            <div className="vp-card" style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>长 JSON 生成测试</h3>
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <span>{longTestResult.apiConnection ? '✅' : '❌'}</span>
                  <span><strong>1. API Connection:</strong> {longTestResult.apiConnection ? '通过' : '失败'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <span>{longTestResult.jsonGeneration ? '✅' : '❌'}</span>
                  <span><strong>2. JSON Parse:</strong> {longTestResult.jsonGeneration ? '通过' : '不通过'}</span>
                </div>
                {longTestResult.requiredFields && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
                    <span>{longTestResult.requiredFields.passed ? '✅' : '❌'}</span>
                    <div>
                      <span><strong>3. Required Fields:</strong> {longTestResult.requiredFields.passed ? '通过' : `不通过 — ${longTestResult.requiredFields.msg}`}</span>
                      {longTestResult.requiredFields.missingFields.length > 0 && (
                        <div style={{ fontSize: 12, color: 'var(--color-text-hint)', marginTop: 4 }}>
                          缺失/不足: {longTestResult.requiredFields.missingFields.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {longTestResult.refValidation && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
                    <span>{longTestResult.refValidation.passed ? '✅' : '⚠️'}</span>
                    <span><strong>4. Reference Validation:</strong> {longTestResult.refValidation.msg}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Short test result */}
          {testResult && (
            <div
              className="vp-card"
              style={{
                marginBottom: 16,
                borderColor: testResult.ok ? 'rgba(18,18,18,0.14)' : 'rgba(18,18,18,0.18)',
                background: testResult.ok ? 'var(--color-success-light)' : 'var(--color-danger-light)',
              }}
            >
              <p style={{ fontSize: 13, color: testResult.ok ? 'var(--color-success)' : 'var(--color-danger)', lineHeight: 1.6 }}>
                {testResult.ok ? '✅ ' : '❌ '}{testResult.msg}
              </p>
            </div>
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
              <p>
                <strong>Q: 不配置 AI 能用吗？</strong><br />
                A: 正式生成不能用。生产环境必须先连接并测试 AI 模型成功；mock fallback 只用于开发调试。
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
