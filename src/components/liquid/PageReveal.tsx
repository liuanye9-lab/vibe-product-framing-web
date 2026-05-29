import React from 'react';

interface PageRevealProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Page entrance animation wrapper.
 * Applies CSS animation: pageReveal (fade-in + slide-up).
 */
const PageReveal: React.FC<PageRevealProps> = ({
  children,
  className = '',
  style,
}) => {
  const cls = `vp-page-reveal ${className}`.trim();

  return (
    <div className={cls} style={style}>
      {children}
    </div>
  );
};

export default PageReveal;
