import React from 'react';

interface LiquidProgressProps {
  percent: number;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Progress bar with gradient fill and percentage display.
 */
const LiquidProgress: React.FC<LiquidProgressProps> = ({
  percent,
  label,
  className = '',
  style,
}) => {
  const clampedPercent = Math.min(100, Math.max(0, percent));

  return (
    <div className={`vp-liquid-progress ${className}`.trim()} style={style}>
      <div className="vp-liquid-progress__label">
        {label && <span>{label}</span>}
        <span>{clampedPercent}%</span>
      </div>
      <div className="vp-liquid-progress__track">
        <div
          className="vp-liquid-progress__fill"
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
    </div>
  );
};

export default LiquidProgress;
