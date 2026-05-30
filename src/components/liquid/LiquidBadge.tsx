import React from 'react';

interface LiquidBadgeProps {
  children: React.ReactNode;
  variant?: 'blue' | 'green' | 'red' | 'orange' | 'purple';
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Small pill badge for status indicators (V4.8 monochrome).
 * Uses CSS: .vp-badge for unified badge styling.
 */
const LiquidBadge: React.FC<LiquidBadgeProps> = ({
  children,
  variant = 'blue',
  className = '',
  style,
}) => {
  const cls = `vp-badge vp-badge--${variant} ${className}`.trim();

  return (
    <span className={cls} style={style}>
      {children}
    </span>
  );
};

export default LiquidBadge;
