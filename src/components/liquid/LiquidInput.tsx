import React from 'react';

interface LiquidInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  rows?: number;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

/**
 * Glass textarea with focus glow effect.
 * Uses CSS: .vp-liquid-input for styling.
 */
const LiquidInput: React.FC<LiquidInputProps> = ({
  value,
  onChange,
  placeholder,
  className = '',
  style,
  rows = 4,
  disabled = false,
  onKeyDown,
}) => {
  return (
    <textarea
      className={`vp-liquid-input ${className}`.trim()}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      style={style}
    />
  );
};

export default LiquidInput;
