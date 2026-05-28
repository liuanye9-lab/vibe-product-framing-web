/**
 * V4.4 API Required Gate
 *
 * Wraps pages that require API. Blocks rendering if API is not ready.
 * Shows clear status card with navigation to Settings.
 */

import type { FC, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Settings as SettingsIcon, RefreshCw, CheckCircle, XCircle, HelpCircle, WifiOff } from 'lucide-react';
import { getApiHealth, type ApiHealthStatus, isApiReady } from '../api/apiHealth';

interface ApiRequiredGateProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

const STATUS_CONFIG: Record<ApiHealthStatus, { icon: ReactNode; color: string; label: string }> = {
  unknown: { icon: <HelpCircle size={18} />, color: 'var(--color-warning)', label: '状态未知' },
  not_configured: { icon: <SettingsIcon size={18} />, color: 'var(--color-text-hint)', label: '未配置' },
  connection_failed: { icon: <WifiOff size={18} />, color: 'var(--color-danger)', label: '连接失败' },
  json_failed: { icon: <XCircle size={18} />, color: 'var(--color-danger)', label: 'JSON 失败' },
  validation_failed: { icon: <AlertTriangle size={18} />, color: 'var(--color-warning)', label: '校验失败' },
  ready: { icon: <CheckCircle size={18} />, color: 'var(--color-success)', label: '就绪' },
};

export const ApiRequiredGate: FC<ApiRequiredGateProps> = ({ children, title, description }) => {
  const navigate = useNavigate();

  if (isApiReady()) return <>{children}</>;

  const health = getApiHealth();
  const cfg = STATUS_CONFIG[health.status] ?? STATUS_CONFIG.not_configured;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', padding: 24,
    }}>
      <div className="vp-card" style={{
        maxWidth: 520, width: '100%', padding: '32px 28px', textAlign: 'center',
      }}>
        {/* Icon */}
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: `${cfg.color}15`, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <span style={{ color: cfg.color }}>{cfg.icon}</span>
        </div>

        {/* Title */}
        <h2 style={{ fontSize: 18, fontWeight: 650, marginBottom: 8 }}>
          {title || 'API 未通过验证'}
        </h2>

        {/* Status badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 20,
          background: `${cfg.color}12`, color: cfg.color,
          fontSize: 12, fontWeight: 600, marginBottom: 16,
        }}>
          {cfg.label}
        </div>

        {/* Description */}
        <p style={{
          fontSize: 13, color: 'var(--color-text-secondary)',
          lineHeight: 1.8, marginBottom: 8,
        }}>
          {description || '当前工作流必须依赖真实大模型 API。API 未通过验证前，系统不会使用本地规则或 mock 结果继续生成。'}
        </p>

        {/* Health message */}
        {health.message && (
          <p style={{
            fontSize: 12, color: 'var(--color-text-hint)',
            marginBottom: 8, lineHeight: 1.6,
          }}>
            {health.message}
          </p>
        )}

        {/* Details */}
        {health.details && (
          <div style={{
            fontSize: 11, color: 'var(--color-text-hint)',
            background: 'var(--color-bg-secondary)',
            padding: '8px 12px', borderRadius: 8,
            marginBottom: 20, textAlign: 'left',
            lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>
            {health.details}
          </div>
        )}

        {/* Model info */}
        {health.model && (
          <p style={{ fontSize: 11, color: 'var(--color-text-hint)', marginBottom: 20 }}>
            当前模型：{health.model}
            {health.apiUrl && ` · ${health.apiUrl.replace(/\/+$/, '').replace(/https?:\/\//, '').slice(0, 30)}`}
          </p>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            className="vp-btn-cta"
            onClick={() => navigate('/settings')}
            style={{ padding: '10px 20px', fontSize: 13 }}
          >
            <SettingsIcon size={14} />
            前往设置
          </button>
          <button
            className="vp-btn vp-btn-ghost"
            onClick={() => window.location.reload()}
            style={{ fontSize: 13 }}
          >
            <RefreshCw size={14} />
            重新检查
          </button>
        </div>
      </div>
    </div>
  );
};
