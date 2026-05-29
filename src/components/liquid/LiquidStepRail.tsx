import React from 'react';

interface PhaseData {
  key: string;
  label: string;
  progressPercent: number;
  status: string;
}

interface LiquidStepRailProps {
  phases: PhaseData[];
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Horizontal step indicator showing progress across multiple phases.
 */
const LiquidStepRail: React.FC<LiquidStepRailProps> = ({
  phases,
  className = '',
  style,
}) => {
  if (!phases.length) return null;

  return (
    <div className={`vp-liquid-step-rail ${className}`.trim()} style={style}>
      {phases.map((phase, index) => {
        const isActive = phase.status === 'confirmed' || phase.status === 'active';
        const isDone = phase.status === 'confirmed' || phase.progressPercent >= 100;
        const dotCls = `vp-liquid-step-rail__dot${isActive ? ' vp-liquid-step-rail__dot--active' : ''}${isDone ? ' vp-liquid-step-rail__dot--done' : ''}`;
        const labelCls = `vp-liquid-step-rail__label${isActive ? ' vp-liquid-step-rail__label--active' : ''}`;
        const lineCls = `vp-liquid-step-rail__line${isDone ? ' vp-liquid-step-rail__line--done' : ''}`;

        return (
          <React.Fragment key={phase.key}>
            {index > 0 && <span className={lineCls} />}
            <div className="vp-liquid-step-rail__step" title={`${phase.label}: ${phase.progressPercent}%`}>
              <span className={dotCls} />
              <span className={labelCls}>{phase.label}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default LiquidStepRail;
