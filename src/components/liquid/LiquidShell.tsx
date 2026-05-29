import React from 'react';

interface LiquidShellProps {
  children: React.ReactNode;
  title?: string;
  showTrafficLights?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * macOS-style app shell with glass header, optional traffic light dots.
 */
const LiquidShell: React.FC<LiquidShellProps> = ({
  children,
  title,
  showTrafficLights = false,
  className = '',
  style,
}) => {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        ...style,
      }}
    >
      {/* Titlebar */}
      <div className="vp-titlebar">
        {showTrafficLights && (
          <div className="vp-traffic-lights">
            <span className="vp-traffic-light vp-traffic-light--red" />
            <span className="vp-traffic-light vp-traffic-light--yellow" />
            <span className="vp-traffic-light vp-traffic-light--green" />
          </div>
        )}
        {title && (
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
            {title}
          </span>
        )}
      </div>
      {/* Content */}
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
};

export default LiquidShell;
