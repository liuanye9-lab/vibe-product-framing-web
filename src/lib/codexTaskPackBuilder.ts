import type { DevSpec, CodexTaskPack, CodexTask, FilePlanItem } from '../types';

export function buildCodexTaskPack(input: {
  devSpec: DevSpec;
  techStack?: string;
  repoContext?: string;
}): CodexTaskPack {
  const { devSpec } = input;
  const techStack = input.techStack || 'React + TypeScript + Vite + Tailwind CSS';

  const tasks = deriveTasks(devSpec);
  const filePlan = deriveFilePlan();
  const implementationSteps = deriveImplementationSteps(tasks);
  const acceptanceTests = devSpec.acceptanceCriteria.slice(0, 5);
  const forbiddenChanges = [
    '不要添加登录/注册系统',
    '不要添加数据库',
    '不要添加后端 API（使用 mock 数据）',
    '不要添加支付功能',
    '不要添加团队协作功能',
    '不要修改项目现有的路由结构',
    '保持现有的设计 token 和组件风格',
  ];

  return {
    title: `Codex Task Pack: ${devSpec.productGoal.slice(0, 60)}`,
    context: `目标用户: ${devSpec.targetUsers.join('、')}\n核心场景: ${devSpec.userScenarios.slice(0, 2).join('；')}`,
    objective: devSpec.productGoal,
    constraints: [`技术栈: ${techStack}`, ...devSpec.nonFunctionalRequirements.slice(0, 3)],
    filePlan,
    tasks,
    implementationSteps,
    acceptanceTests,
    forbiddenChanges,
    progressChecklist: tasks.map((t, i) => ({
      label: t.name,
      percent: Math.round(((i + 1) / tasks.length) * 100),
      done: false,
    })),
    generatedAt: new Date().toISOString(),
  };
}

function deriveTasks(devSpec: DevSpec): CodexTask[] {
  const tasks: CodexTask[] = [];
  devSpec.p0Features.forEach((feature, i) => {
    tasks.push({
      id: `task-${i + 1}`,
      name: feature.slice(0, 40),
      description: `实现 ${feature}`,
      files: [],
      dependencies: i > 0 ? [`task-${i}`] : [],
      acceptanceCriteria: [getAcceptanceFor(feature)],
      priority: 'P0',
    });
  });
  return tasks;
}

function deriveFilePlan(): FilePlanItem[] {
  return [
    { path: 'src/types.ts', purpose: '类型定义', dependencies: [] },
    { path: 'src/data/mockData.ts', purpose: 'Mock 数据', dependencies: ['src/types.ts'] },
    { path: 'src/App.tsx', purpose: '路由配置', dependencies: ['src/types.ts'] },
    { path: 'src/pages/HomePage.tsx', purpose: '首页', dependencies: ['src/App.tsx'] },
  ];
}

function deriveImplementationSteps(tasks: CodexTask[]): string[] {
  return [
    '1. 审计当前项目结构',
    ...tasks.map((t, i) => `${i + 2}. ${t.name}`),
    `${tasks.length + 2}. 运行 lint 和 build 验证`,
    `${tasks.length + 3}. 验证验收标准`,
  ];
}

function getAcceptanceFor(feature: string): string {
  return `用户能够完成 ${feature} 的完整操作流程，并获得明确的反馈结果。`;
}

export function formatCodexTaskPackMarkdown(pack: CodexTaskPack): string {
  const lines: string[] = [
    '# CODEX_TASK_PACK',
    '',
    `> 生成时间: ${pack.generatedAt || 'N/A'}`,
    '',
    `## 标题`,
    pack.title,
    '',
    `## 上下文`,
    pack.context,
    '',
    `## 目标`,
    pack.objective,
    '',
    '## 约束条件',
    ...pack.constraints.map((c) => `- ${c}`),
    '',
    '## 任务列表',
  ];

  for (const t of pack.tasks) {
    lines.push(`### ${t.id}: ${t.name}`);
    lines.push(`- 优先级: ${t.priority}`);
    lines.push(`- 依赖: ${t.dependencies.join(', ') || '无'}`);
    lines.push(`- 验收: ${t.acceptanceCriteria.join('；')}`);
    lines.push('');
  }

  lines.push('## 实现步骤');
  for (const s of pack.implementationSteps) {
    lines.push(s);
  }

  lines.push('');
  lines.push('## 文件计划');
  for (const f of pack.filePlan) {
    lines.push(`- \`${f.path}\`: ${f.purpose}`);
  }

  lines.push('');
  lines.push('## 禁止修改');
  for (const c of pack.forbiddenChanges) {
    lines.push(`- ${c}`);
  }

  lines.push('');
  lines.push('## 进度清单');
  for (const p of pack.progressChecklist) {
    lines.push(`- [${p.done ? 'x' : ' '}] ${p.label} (${p.percent}%)`);
  }

  return lines.join('\n');
}
