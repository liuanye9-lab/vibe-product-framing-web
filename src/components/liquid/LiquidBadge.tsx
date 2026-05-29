import React from 'react';

interface LiquidBadgeProps {
  children: React.ReactNode;
  variant?: 'blue' | 'green' | 'red' | 'orange' | 'purple';
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Small pill badge for status indicators.
 */
const LiquidBadge: React.FC<LiquidBadgeProps> = ({
  children,
  variant = 'blue',
  className = '',
  style,
}) => {
  const cls = `vp-liquid-badge vp-liquid-badge--${variant} ${className}`.trim();

  return (
    <span className={cls} style={style}>
      {children}
    </span>
  );
};

export default LiquidBadge;
