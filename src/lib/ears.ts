import type { EarsRequirement } from '../types';

export function generateEarsAcceptanceCriteria(input: {
  p0Features: string[];
  userScenarios: string[];
  outOfScope: string[];
}): EarsRequirement[] {
  const results: EarsRequirement[] = [];
  let id = 0;

  // Ubiquitous: 系统始终满足的行为
  results.push({
    id: `ears-${++id}`,
    type: 'ubiquitous',
    text: '系统应始终在 3 秒内响应用户操作。',
  });
  results.push({
    id: `ears-${++id}`,
    type: 'ubiquitous',
    text: '系统应在所有页面提供返回首页的导航入口。',
  });

  // Event-driven: 基于 P0 功能
  for (const feature of input.p0Features.slice(0, 3)) {
    results.push({
      id: `ears-${++id}`,
      type: 'event_driven',
      text: `当用户执行 ${feature} 时，系统应提供明确的反馈结果。`,
    });
  }

  // State-driven: 基于用户场景
  for (const scenario of input.userScenarios.slice(0, 2)) {
    results.push({
      id: `ears-${++id}`,
      type: 'state_driven',
      text: `在 ${scenario} 场景下，系统应保持数据状态一致。`,
    });
  }

  // Optional: 可选功能
  results.push({
    id: `ears-${++id}`,
    type: 'optional',
    text: '系统可以提供深色模式切换功能（P2 需求）。',
  });

  // Unwanted: Out of Scope
  for (const item of input.outOfScope.slice(0, 2)) {
    results.push({
      id: `ears-${++id}`,
      type: 'unwanted',
      text: `V1 不应包含 ${item} 功能。`,
    });
  }

  return results;
}

export function formatEarsMarkdown(requirements: EarsRequirement[]): string {
  const typeLabels: Record<string, string> = {
    ubiquitous: '始终满足',
    event_driven: '事件驱动',
    state_driven: '状态驱动',
    optional: '可选功能',
    unwanted: '不在范围内',
  };
  return requirements
    .map((r) => `- [${typeLabels[r.type]}] ${r.text}`)
    .join('\n');
}
