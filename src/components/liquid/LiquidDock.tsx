import React from 'react';

interface DockItem {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

interface LiquidDockProps {
  items: DockItem[];
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Floating bottom dock for quick actions with glass effect.
 */
const LiquidDock: React.FC<LiquidDockProps> = ({
  items,
  className = '',
  style,
}) => {
  if (!items.length) return null;

  return (
    <div className={`vp-liquid-dock ${className}`.trim()} style={style}>
      {items.map((item, index) => (
        <button
          key={index}
          className="vp-liquid-dock__item"
          onClick={item.onClick}
          title={item.label}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
};

export default LiquidDock;
