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
 * iOS-style pill button with glass effect.
 * Variants: primary (blue gradient), secondary (glass), ghost (transparent).
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
  const variantClass = `vp-liquid-button--${variant}`;
  const cls = `vp-liquid-button ${variantClass} ${className}`.trim();

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
