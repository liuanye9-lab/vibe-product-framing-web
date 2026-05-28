import { memo, useState } from 'react';
import { Check, AlertTriangle } from 'lucide-react';

interface ConfirmButtonProps {
  label: string;
  onConfirm: () => void;
  warning?: string;
  disabled?: boolean;
}

const ConfirmButton = memo(function ConfirmButton({ label, onConfirm, warning, disabled }: ConfirmButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  if (showConfirm) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {warning && (
          <span style={{ fontSize: 11, color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={12} />
            {warning}
          </span>
        )}
        <button
          className="vp-btn vp-btn-primary"
          onClick={() => { onConfirm(); setShowConfirm(false); }}
          style={{ fontSize: 12, padding: '6px 14px' }}
        >
          <Check size={14} /> 确认
        </button>
        <button
          className="vp-btn vp-btn-ghost"
          onClick={() => setShowConfirm(false)}
          style={{ fontSize: 12, padding: '6px 14px' }}
        >
          取消
        </button>
      </div>
    );
  }

  return (
    <button
      className="vp-btn vp-btn-ghost"
      onClick={() => setShowConfirm(true)}
      disabled={disabled}
      style={{ fontSize: 12 }}
    >
      <Check size={14} /> {label}
    </button>
  );
});

ConfirmButton.displayName = 'ConfirmButton';
export default ConfirmButton;
