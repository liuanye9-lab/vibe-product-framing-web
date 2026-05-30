import React from 'react';

interface LiquidCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  padding?: string;
}

/**
 * Glass card with hover effect (V4.8 monochrome).
 * Uses CSS: .vp-card for unified card styling.
 */
const LiquidCard: React.FC<LiquidCardProps> = ({
  children,
  className = '',
  style,
  onClick,
  padding,
}) => {
  return (
    <div
      className={`vp-card ${className}`.trim()}
      style={{
        padding: padding ?? '20px',
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default LiquidCard;
