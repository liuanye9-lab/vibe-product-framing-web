import React from 'react';

interface LiquidButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  type?: 'button' | 'submit';
}

/**
 * Pill button with unified styling (V4.8 monochrome).
 * Variants: primary (solid dark), secondary (ghost with border), ghost (text-only).
 */
const LiquidButton: React.FC<LiquidButtonProps> = ({
  children,
  variant = 'primary',
  onClick,
  disabled = false,
  className = '',
  style,
  type = 'button',
}) => {
  const variantClass =
    variant === 'primary' ? 'vp-btn-primary' :
    variant === 'secondary' ? 'vp-btn-ghost' :
    'vp-btn-text';
  const cls = `vp-btn ${variantClass} ${className}`.trim();

  return (
    <button
      type={type}
      className={cls}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      {children}
    </button>
  );
};

export default LiquidButton;
