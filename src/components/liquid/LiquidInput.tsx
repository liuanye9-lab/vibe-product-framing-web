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
 * Glass textarea with focus glow (V4.8 monochrome).
 * Uses CSS: .vp-textarea for unified input styling.
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
      className={`vp-textarea ${className}`.trim()}
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
