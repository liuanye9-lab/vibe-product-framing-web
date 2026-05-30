import React from 'react';

interface AuroraBackgroundProps {
  children: React.ReactNode;
  intensity?: 'light' | 'medium';
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Simple background wrapper (V4.8 monochrome — no gradient orbs).
 * Uses CSS class vp-aurora-bg for solid background.
 */
const AuroraBackground: React.FC<AuroraBackgroundProps> = ({
  children,
  intensity = 'light',
  className = '',
  style,
}) => {
  const cls = `vp-aurora-bg${intensity === 'medium' ? ' vp-aurora-bg--medium' : ''} ${className}`.trim();

  return (
    <div className={cls} style={{ minHeight: '100vh', ...style }}>
      {children}
    </div>
  );
};

export default AuroraBackground;
