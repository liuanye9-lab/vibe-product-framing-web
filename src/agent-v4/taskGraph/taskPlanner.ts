/**
 * V5.2 Task Planner — Generates initial decision tasks for a new TaskGraph
 *
 * Creates 9 canonical tasks from Raw Idea to CODEX_TASK_PACK.
 * Key tasks require human approval before proceeding.
 */

import type { AgentTask, AgentStep, AgentRole } from './taskGraphTypes';
import { generateTaskGraphId } from './taskGraphTypes';

interface TaskTemplate {
  title: string;
  description: string;
  ownerAgent: AgentRole;
  progressPercent: number;
  inputSummary: string;
  expectedOutput: string;
  acceptanceCriteria: string[];
  requiresApproval: boolean;
  steps: { title: string; description: string }[];
}

const DECISION_TASK_TEMPLATES: TaskTemplate[] = [
  {
    title: 'Problem Framing',
    description: '明确问题定义、目标用户画像、痛点边界。这是所有后续决策的基础。',
    ownerAgent: 'problem',
    progressPercent: 10,
    inputSummary: 'Raw Idea + 用户补充信息',
    expectedOutput: '清晰的问题陈述、目标用户、痛点边界、现有替代方案',
    acceptanceCriteria: [
      '问题陈述不超过 2 句话',
      '目标用户有明确画像',
      '痛点有具体场景支撑',
      '至少识别 1 个现有替代方案',
    ],
    requiresApproval: false,
    steps: [
      { title: '分析 Raw Idea', description: '从用户输入中提取核心问题和目标' },
      { title: '识别目标用户', description: '明确目标用户群体和使用场景' },
      { title: '发现痛点边界', description: '界定问题的范围和限制' },
      { title: '创建 Observation', description: '将分析结果写入 Observation' },
    ],
  },
  {
    title: 'User Scenario',
    description: '明确用户场景、触发时刻、使用路径、成功标准。',
    ownerAgent: 'user_scenario',
    progressPercent: 20,
    inputSummary: 'Problem Framing 结果',
    expectedOutput: '完整的用户旅程：触发条件 → 使用路径 → 成功标准',
    acceptanceCriteria: [
      '至少 1 个完整用户旅程',
      '有明确的触发条件',
      '有可观察的成功标准',
    ],
    requiresApproval: false,
    steps: [
      { title: '定义触发条件', description: '用户在什么情况下会使用这个产品' },
      { title: '绘制使用路径', description: '从触发到完成的完整流程' },
      { title: '设定成功标准', description: '用户如何知道自己成功了' },
      { title: '创建 Observation', description: '将场景分析写入 Observation' },
    ],
  },
  {
    title: 'Demand Evidence',
    description: '收集需求证据、现有替代方案、需求强度信号。',
    ownerAgent: 'problem',
    progressPercent: 30,
    inputSummary: 'Problem Framing + User Scenario 结果',
    expectedOutput: '需求证据清单：搜索信号、竞品分析、用户痛点强度',
    acceptanceCriteria: [
      '至少识别 1 个需求强度信号',
      '列出至少 1 个替代方案',
      '评估需求强度（强/中/弱）',
    ],
    requiresApproval: false,
    steps: [
      { title: '分析需求信号', description: '从用户输入中识别需求强度指标' },
      { title: '识别替代方案', description: '用户目前如何解决这个问题' },
      { title: '评估需求强度', description: '综合判断需求的真实性和强度' },
      { title: '创建 Observation', description: '将需求分析写入 Observation' },
    ],
  },
  {
    title: 'MVP Scope',
    description: '定义 MVP 范围：P0 必须有、P1 应该有、P2 可以有、Out of Scope。',
    ownerAgent: 'scope',
    progressPercent: 45,
    inputSummary: '前三个任务的 Observation',
    expectedOutput: 'P0/P1/P2/Out of Scope 分类 + 范围风险',
    acceptanceCriteria: [
      'P0 不超过 5 个功能',
      '有明确的 Out of Scope',
      '有范围膨胀风险提示',
      '用户确认 MVP 范围',
    ],
    requiresApproval: true,
    steps: [
      { title: '提取核心功能', description: '从需求中提取最小可行功能集' },
      { title: '分类优先级', description: 'P0/P1/P2/Out of Scope 四级分类' },
      { title: '检测范围膨胀', description: '识别可能导致范围膨胀的风险' },
      { title: '请求用户确认', description: 'MVP 范围需要用户确认' },
    ],
  },
  {
    title: 'Risk Counterargument',
    description: '反证分析：这个产品可能失败的原因、技术风险、市场风险。',
    ownerAgent: 'risk',
    progressPercent: 60,
    inputSummary: 'MVP Scope + 前序 Observation',
    expectedOutput: '风险清单、反证论点、失败条件、缓解策略',
    acceptanceCriteria: [
      '至少 3 个风险点',
      '每个风险有缓解策略',
      '至少 1 个反证论点',
    ],
    requiresApproval: true,
    steps: [
      { title: '识别需求风险', description: '需求不清晰、用户不存在等风险' },
      { title: '识别技术风险', description: '技术可行性、实现复杂度等风险' },
      { title: '识别范围风险', description: '范围膨胀、功能过多等风险' },
      { title: '生成缓解策略', description: '为每个风险提供缓解方案' },
      { title: '请求用户确认', description: '风险分析需要用户确认' },
    ],
  },
  {
    title: 'Tech Constraints',
    description: '技术约束分析：技术栈、数据结构、实现约束、部署要求。',
    ownerAgent: 'tech',
    progressPercent: 72,
    inputSummary: 'MVP Scope + Risk Counterargument',
    expectedOutput: '技术栈选择、数据结构、实现约束、部署方案',
    acceptanceCriteria: [
      '明确技术栈选择',
      '有数据结构定义',
      '有实现约束说明',
      '有部署方案',
    ],
    requiresApproval: false,
    steps: [
      { title: '确定技术栈', description: '选择前端/后端/数据库/AI 技术栈' },
      { title: '设计数据结构', description: '定义核心数据实体和关系' },
      { title: '明确实现约束', description: '确定 V1 必须遵守的技术限制' },
      { title: '创建 Observation', description: '将技术分析写入 Observation' },
    ],
  },
  {
    title: 'Acceptance Criteria',
    description: '生成 EARS 风格验收标准：可测试、可观察、可验证。',
    ownerAgent: 'acceptance',
    progressPercent: 84,
    inputSummary: 'User Scenario + MVP Scope + Tech Constraints',
    expectedOutput: 'EARS 格式验收标准列表',
    acceptanceCriteria: [
      '至少 3 条验收标准',
      '每条标准可测试',
      '覆盖 P0 核心功能',
    ],
    requiresApproval: false,
    steps: [
      { title: '生成 EARS 需求', description: '基于场景和功能生成验收标准' },
      { title: '验证可测试性', description: '确保每条标准可以被验证' },
      { title: '创建 Observation', description: '将验收标准写入 Observation' },
    ],
  },
  {
    title: 'DEV_SPEC',
    description: '生成可执行开发规格：产品目标、功能清单、技术架构、验收标准。',
    ownerAgent: 'handoff',
    progressPercent: 94,
    inputSummary: '所有前序任务的 Observation',
    expectedOutput: '完整的 DevSpec 对象',
    acceptanceCriteria: [
      '包含 productGoal',
      '包含 p0Features',
      '包含 acceptanceCriteria',
      '包含 coreFlows',
    ],
    requiresApproval: true,
    steps: [
      { title: '汇总前序分析', description: '收集所有任务的 Observation 作为输入' },
      { title: '构建 DevSpec', description: '调用 buildDevSpec 生成开发规格' },
      { title: '验证完整性', description: '检查 DevSpec 是否包含所有必要字段' },
      { title: '请求用户确认', description: 'DevSpec 需要用户确认后才能生成任务包' },
    ],
  },
  {
    title: 'CODEX_TASK_PACK',
    description: '生成可复制给 Codex 的任务包：目标、约束、文件计划、实现步骤、验收测试。',
    ownerAgent: 'handoff',
    progressPercent: 100,
    inputSummary: 'DEV_SPEC + Tech Constraints',
    expectedOutput: '完整的 CodexTaskPack 对象',
    acceptanceCriteria: [
      '包含 objective',
      '包含 constraints',
      '包含 filePlan',
      '包含 implementationSteps',
      '包含 acceptanceTests',
      '包含 forbiddenChanges',
      '包含 progressChecklist',
      '包含 npm run lint / npm run build 验收',
    ],
    requiresApproval: true,
    steps: [
      { title: '构建 CodexTaskPack', description: '调用 buildCodexTaskPack 生成任务包' },
      { title: '校验任务包', description: '调用 validateCodexTaskPack 校验完整性' },
      { title: '请求用户确认', description: '最终任务包需要用户确认' },
    ],
  },
];

// ─── Public API ─────────────────────────────────────────────────────────────

export function buildInitialDecisionTasks(input: {
  briefId: string;
  rawIdea: string;
}): AgentTask[] {
  // input.briefId and input.rawIdea are available for future task customization
  void input;
  const now = new Date().toISOString();

  return DECISION_TASK_TEMPLATES.map((tpl, index) => {
    const taskId = generateTaskGraphId('task');
    const steps: AgentStep[] = tpl.steps.map((step, stepIdx) => ({
      id: generateTaskGraphId('step'),
      taskId,
      title: step.title,
      description: step.description,
      status: index === 0 && stepIdx === 0 ? 'pending' : 'pending',
      createdAt: now,
      updatedAt: now,
    }));

    return {
      id: taskId,
      title: tpl.title,
      description: tpl.description,
      ownerAgent: tpl.ownerAgent,
      status: (index === 0 ? 'todo' : 'todo') as AgentTask['status'],
      progressPercent: 0,
      inputSummary: tpl.inputSummary,
      expectedOutput: tpl.expectedOutput,
      acceptanceCriteria: tpl.acceptanceCriteria,
      steps,
      toolCalls: [],
      observations: [],
      requiresApproval: tpl.requiresApproval,
      createdAt: now,
      updatedAt: now,
    };
  });
}

export function buildTaskEdges(tasks: AgentTask[]): import('./taskGraphTypes').AgentTaskEdge[] {
  const edges: import('./taskGraphTypes').AgentTaskEdge[] = [];
  for (let i = 0; i < tasks.length - 1; i++) {
    edges.push({
      id: generateTaskGraphId('edge'),
      fromTaskId: tasks[i].id,
      toTaskId: tasks[i + 1].id,
      condition: `${tasks[i].title} completed`,
    });
  }
  return edges;
}

export function getTaskTemplateInfo(): { title: string; ownerAgent: AgentRole; requiresApproval: boolean }[] {
  return DECISION_TASK_TEMPLATES.map(t => ({
    title: t.title,
    ownerAgent: t.ownerAgent,
    requiresApproval: t.requiresApproval,
  }));
}
