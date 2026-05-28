/**
 * Agent Skill Panel — displays reusable skill library.
 */

import { type FC } from 'react';
import { Zap, ChevronRight } from 'lucide-react';
import { getAllSkills } from '../memory/skillLibrary';

export const AgentSkillPanel: FC = () => {
  const skills = getAllSkills();

  if (skills.length === 0) {
    return (
      <div style={{ padding: 8, fontSize: 12, color: 'var(--color-text-hint)', textAlign: 'center' }}>
        暂无技能 — 当重复模式被检测到时，Reflection 节点会自动生成。
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
      {skills.map((skill) => (
        <div
          key={skill.id}
          className="vp-card"
          style={{ padding: '8px 12px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <Zap size={12} style={{ color: 'var(--color-primary)' }} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>{skill.title}</span>
          </div>
          {skill.triggerTags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 4 }}>
              {skill.triggerTags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: 9,
                    padding: '1px 5px',
                    borderRadius: 6,
                    background: 'var(--color-surface)',
                    color: 'var(--color-text-hint)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {skill.applicableWhen && (
            <p style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
              适用条件: {skill.applicableWhen}
            </p>
          )}
          {skill.recommendedSteps.length > 0 && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 500, marginBottom: 2 }}>推荐步骤:</p>
              {skill.recommendedSteps.slice(0, 4).map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 3, fontSize: 10, color: 'var(--color-text-secondary)' }}>
                  <ChevronRight size={10} style={{ marginTop: 2 }} />
                  {step}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
