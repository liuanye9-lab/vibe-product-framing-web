/**
 * V5.2 TaskGraph Tools — Real agent workflow tools with permission metadata
 *
 * Each tool has:
 * - inputSchema / outputSchema
 * - permissionLevel / sideEffect / requiresApproval
 * - Real execute function that calls project-internal utilities
 *
 * Tools return structured results, NOT raw LLM text.
 */

import type {
  ToolPermissionLevel,
  ToolSideEffect,
  AgentToolCallRecord,
  AgentObservation,
  HumanApproval,
} from '../taskGraphTypes';
import { generateTaskGraphId } from '../taskGraphTypes';
import type { ProductBrief, RequirementQualityScore, AmbiguityIssue, ScopeControlResult, EarsRequirement, DevSpec, CodexTaskPack } from '../../../types';
import type { AgentGraphState } from '../../types';
import { evaluateRequirementQuality } from '../../../lib/requirementQuality';
import { detectRequirementAmbiguity } from '../../../lib/ambiguityDetector';
import { deriveScopeControl } from '../../../lib/scopeControl';
import { generateEarsAcceptanceCriteria } from '../../../lib/ears';
import { buildDevSpec } from '../../../lib/devSpecBuilder';
import { buildCodexTaskPack } from '../../../lib/codexTaskPackBuilder';
import { addMemory, type AgentMemoryEntry } from '../memoryRuntime';
import { saveSkill } from '../skillLibrary';

// ─── Tool Result Type ───────────────────────────────────────────────────────

export interface TaskGraphToolResult {
  success: boolean;
  message: string;
  data?: unknown;
  briefPatch?: Partial<ProductBrief>;
  observation?: AgentObservation;
  approval?: HumanApproval;
  toolCallRecord?: AgentToolCallRecord;
}

// ─── Tool Definition ────────────────────────────────────────────────────────

export interface TaskGraphToolDef {
  name: string;
  description: string;
  permissionLevel: ToolPermissionLevel;
  sideEffect: ToolSideEffect;
  requiresApproval: boolean;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  execute: (input: {
    brief: ProductBrief;
    state: AgentGraphState;
    payload: Record<string, unknown>;
    taskId?: string;
  }) => Promise<TaskGraphToolResult>;
}

// ─── Helper: Create Observation ─────────────────────────────────────────────

function makeObservation(input: {
  taskId: string;
  stepId?: string;
  toolCallId?: string;
  source: 'tool' | 'ai' | 'user' | 'system';
  title: string;
  content: string;
  evidence?: string[];
  risks?: string[];
  nextSuggestion?: string;
}): AgentObservation {
  return {
    id: generateTaskGraphId('obs'),
    taskId: input.taskId,
    stepId: input.stepId,
    toolCallId: input.toolCallId,
    source: input.source,
    title: input.title,
    content: input.content,
    evidence: input.evidence ?? [],
    risks: input.risks ?? [],
    nextSuggestion: input.nextSuggestion ?? '',
    createdAt: new Date().toISOString(),
  };
}

// ─── Tool 1: inspectBriefContext ────────────────────────────────────────────

const inspectBriefContextTool: TaskGraphToolDef = {
  name: 'inspectBriefContext',
  description: '读取当前 ProductBrief 的核心上下文，识别已知字段和缺失字段',
  permissionLevel: 'read',
  sideEffect: 'none',
  requiresApproval: false,
  inputSchema: { briefId: 'string' },
  outputSchema: { rawIdea: 'string', knownFields: 'string[]', missingFields: 'string[]', summary: 'string' },
  execute: async ({ brief, taskId }) => {
    const knownFields: string[] = [];
    const missingFields: string[] = [];

    // Check ideaInput
    if (brief.rawIdea) knownFields.push('rawIdea');
    else missingFields.push('rawIdea');
    if (brief.ideaInput?.targetUser) knownFields.push('targetUser');
    else missingFields.push('targetUser');
    if (brief.ideaInput?.scenario) knownFields.push('scenario');
    else missingFields.push('scenario');
    if (brief.ideaInput?.problem) knownFields.push('problem');
    else missingFields.push('problem');

    // Check stages
    if (brief.stages?.discovery) knownFields.push('discovery');
    else missingFields.push('discovery');
    if (brief.stages?.product) knownFields.push('product');
    else missingFields.push('product');
    if (brief.stages?.mvp) knownFields.push('mvp');
    else missingFields.push('mvp');
    if (brief.stages?.technical) knownFields.push('technical');
    else missingFields.push('technical');
    if (brief.stages?.blindSpot) knownFields.push('blindSpot');
    else missingFields.push('blindSpot');

    // Check finalHandoff
    if (brief.finalHandoff?.devSpec) knownFields.push('devSpec');
    else missingFields.push('devSpec');
    if (brief.finalHandoff?.acceptanceCriteria) knownFields.push('acceptanceCriteria');
    else missingFields.push('acceptanceCriteria');

    const summary = `已知 ${knownFields.length} 项，缺失 ${missingFields.length} 项。` +
      (brief.rawIdea ? `想法: ${brief.rawIdea.slice(0, 100)}` : '无原始想法');

    const observation = makeObservation({
      taskId: taskId || 'unknown',
      source: 'tool',
      title: 'Brief 上下文检查',
      content: summary,
      evidence: knownFields,
      risks: missingFields.length > 3 ? ['缺失关键信息较多，可能影响后续分析质量'] : [],
      nextSuggestion: missingFields.length > 0
        ? `建议补充: ${missingFields.slice(0, 3).join(', ')}`
        : '信息较完整，可以继续下一步',
    });

    return {
      success: true,
      message: summary,
      data: { rawIdea: brief.rawIdea, knownFields, missingFields, summary },
      observation,
    };
  },
};

// ─── Tool 2: evaluateRequirementQualityTool ─────────────────────────────────

const evaluateRequirementQualityTool: TaskGraphToolDef = {
  name: 'evaluateRequirementQualityTool',
  description: '评估需求质量，返回 8 维度评分和改进建议',
  permissionLevel: 'read',
  sideEffect: 'none',
  requiresApproval: false,
  inputSchema: {},
  outputSchema: { score: 'RequirementQualityScore' },
  execute: async ({ brief, taskId }) => {
    try {
      const score: RequirementQualityScore = evaluateRequirementQuality(brief);
      const observation = makeObservation({
        taskId: taskId || 'unknown',
        source: 'tool',
        title: '需求质量评估',
        content: `总分: ${score.total}/40。${score.issues.length > 0 ? `问题: ${score.issues.join('; ')}` : '无明显问题'}`,
        evidence: [`清晰度: ${score.clarity}/5`, `可测试性: ${score.testability}/5`],
        risks: score.issues,
        nextSuggestion: score.improvementSuggestions[0] || '质量良好',
      });

      return {
        success: true,
        message: `需求质量评分: ${score.total}/40`,
        data: { score },
        observation,
      };
    } catch (err) {
      return {
        success: false,
        message: `需求质量评估失败: ${err instanceof Error ? err.message : 'unknown'}`,
      };
    }
  },
};

// ─── Tool 3: detectAmbiguityTool ────────────────────────────────────────────

const detectAmbiguityTool: TaskGraphToolDef = {
  name: 'detectAmbiguityTool',
  description: '检测需求中的模糊点和不清晰表达',
  permissionLevel: 'read',
  sideEffect: 'none',
  requiresApproval: false,
  inputSchema: {},
  outputSchema: { ambiguityIssues: 'AmbiguityIssue[]' },
  execute: async ({ brief, taskId }) => {
    try {
      const mvpValue = brief.stages?.mvp?.mustHave?.value;
      const ambiguityIssues: AmbiguityIssue[] = detectRequirementAmbiguity({
        rawIdea: brief.rawIdea,
        problemFraming: brief.stages?.product?.corePainPoint?.value as string,
        userScenario: brief.stages?.product?.scenario?.value as string,
        mvpScope: Array.isArray(mvpValue)
          ? (mvpValue as string[]).join(', ')
          : typeof mvpValue === 'string' ? mvpValue : undefined,
        acceptanceCriteria: brief.finalHandoff?.acceptanceCriteria,
      });

      const observation = makeObservation({
        taskId: taskId || 'unknown',
        source: 'tool',
        title: '歧义检测',
        content: `发现 ${ambiguityIssues.length} 个模糊点`,
        evidence: ambiguityIssues.map(i => `[${i.severity}] ${i.message}`),
        risks: ambiguityIssues.filter(i => i.severity === 'high').map(i => i.message),
        nextSuggestion: ambiguityIssues.length > 0
          ? `建议澄清: ${ambiguityIssues[0].question || ambiguityIssues[0].message}`
          : '需求表达清晰',
      });

      return {
        success: true,
        message: `发现 ${ambiguityIssues.length} 个模糊点`,
        data: { ambiguityIssues },
        observation,
      };
    } catch (err) {
      return {
        success: false,
        message: `歧义检测失败: ${err instanceof Error ? err.message : 'unknown'}`,
      };
    }
  },
};

// ─── Tool 4: deriveScopeControlTool ─────────────────────────────────────────

const deriveScopeControlTool: TaskGraphToolDef = {
  name: 'deriveScopeControlTool',
  description: '从原始想法中推导 MVP 范围控制：P0/P1/P2/Out of Scope',
  permissionLevel: 'generate_artifact',
  sideEffect: 'artifact_generation',
  requiresApproval: false,
  inputSchema: { rawIdea: 'string', featuresText: 'string?', projectType: 'string?' },
  outputSchema: { p0: 'string[]', p1: 'string[]', p2: 'string[]', outOfScope: 'string[]' },
  execute: async ({ brief, payload, taskId }) => {
    try {
      const result: ScopeControlResult = deriveScopeControl({
        rawIdea: (payload.rawIdea as string) || brief.rawIdea,
        featuresText: payload.featuresText as string | undefined,
        projectType: payload.projectType as string | undefined,
      });

      const observation = makeObservation({
        taskId: taskId || 'unknown',
        source: 'tool',
        title: 'MVP 范围控制',
        content: `P0: ${result.p0.length} 项, Out of Scope: ${result.outOfScope.length} 项`,
        evidence: result.p0.map(f => `P0: ${f}`),
        risks: result.scopeRisks,
        nextSuggestion: result.suggestions[0] || '范围合理',
      });

      return {
        success: true,
        message: `范围控制完成: P0 ${result.p0.length} 项`,
        data: result,
        observation,
      };
    } catch (err) {
      return {
        success: false,
        message: `范围控制失败: ${err instanceof Error ? err.message : 'unknown'}`,
      };
    }
  },
};

// ─── Tool 5: generateEarsCriteriaTool ───────────────────────────────────────

const generateEarsCriteriaTool: TaskGraphToolDef = {
  name: 'generateEarsCriteriaTool',
  description: '生成 EARS 风格验收标准',
  permissionLevel: 'generate_artifact',
  sideEffect: 'artifact_generation',
  requiresApproval: false,
  inputSchema: { p0Features: 'string[]', userScenarios: 'string[]', outOfScope: 'string[]' },
  outputSchema: { earsRequirements: 'EarsRequirement[]' },
  execute: async ({ payload, taskId }) => {
    try {
      const p0Features = (payload.p0Features as string[]) || [];
      const userScenarios = (payload.userScenarios as string[]) || [];
      const outOfScope = (payload.outOfScope as string[]) || [];

      const earsRequirements: EarsRequirement[] = generateEarsAcceptanceCriteria({
        p0Features,
        userScenarios,
        outOfScope,
      });

      const observation = makeObservation({
        taskId: taskId || 'unknown',
        source: 'tool',
        title: 'EARS 验收标准生成',
        content: `生成 ${earsRequirements.length} 条验收标准`,
        evidence: earsRequirements.map(r => `[${r.type}] ${r.text}`),
        risks: [],
        nextSuggestion: '验收标准已生成，可以继续生成 DEV_SPEC',
      });

      return {
        success: true,
        message: `生成 ${earsRequirements.length} 条 EARS 验收标准`,
        data: { earsRequirements },
        observation,
      };
    } catch (err) {
      return {
        success: false,
        message: `EARS 生成失败: ${err instanceof Error ? err.message : 'unknown'}`,
      };
    }
  },
};

// ─── Tool 6: buildDevSpecTool ───────────────────────────────────────────────

const buildDevSpecTool: TaskGraphToolDef = {
  name: 'buildDevSpecTool',
  description: '生成完整开发规格 (DEV_SPEC)',
  permissionLevel: 'generate_artifact',
  sideEffect: 'artifact_generation',
  requiresApproval: false,
  inputSchema: {},
  outputSchema: { devSpec: 'DevSpec' },
  execute: async ({ brief, taskId }) => {
    try {
      const devSpec: DevSpec = buildDevSpec(brief);

      const observation = makeObservation({
        taskId: taskId || 'unknown',
        source: 'tool',
        title: 'DEV_SPEC 生成',
        content: `生成 DevSpec: ${devSpec.p0Features.length} P0 功能, ${devSpec.acceptanceCriteria.length} 验收标准`,
        evidence: [
          `产品目标: ${devSpec.productGoal}`,
          `P0 功能: ${devSpec.p0Features.join(', ')}`,
        ],
        risks: devSpec.risks,
        nextSuggestion: 'DEV_SPEC 已生成，建议用户确认后生成 CODEX_TASK_PACK',
      });

      return {
        success: true,
        message: `DEV_SPEC 生成完成: ${devSpec.p0Features.length} P0 功能`,
        data: { devSpec },
        observation,
        briefPatch: {
          finalHandoff: {
            ...brief.finalHandoff,
            productBrief: JSON.stringify(brief),
            mvpScope: devSpec.p0Features.join('\n'),
            devSpec: JSON.stringify(devSpec),
            technicalArchitecture: devSpec.coreFlows.join('\n'),
            dataStructure: devSpec.dataEntities.join('\n'),
            acceptanceCriteria: devSpec.acceptanceCriteria.join('\n'),
            developmentPrompt: '',
            source: 'ai' as const,
          },
        },
      };
    } catch (err) {
      return {
        success: false,
        message: `DEV_SPEC 生成失败: ${err instanceof Error ? err.message : 'unknown'}`,
      };
    }
  },
};

// ─── Tool 7: buildCodexTaskPackTool ─────────────────────────────────────────

const buildCodexTaskPackTool: TaskGraphToolDef = {
  name: 'buildCodexTaskPackTool',
  description: '生成可复制给 Codex 的任务包 (CODEX_TASK_PACK)',
  permissionLevel: 'generate_artifact',
  sideEffect: 'artifact_generation',
  requiresApproval: false,
  inputSchema: { techStack: 'string?', repoContext: 'string?' },
  outputSchema: { codexTaskPack: 'CodexTaskPack' },
  execute: async ({ brief, payload, taskId }) => {
    try {
      // Build DevSpec from brief (not from finalHandoff.devSpec which is a string)
      const devSpec = buildDevSpec(brief);

      const codexTaskPack: CodexTaskPack = buildCodexTaskPack({
        devSpec,
        techStack: (payload.techStack as string) || 'React + TypeScript + Vite + Tailwind CSS',
        repoContext: payload.repoContext as string | undefined,
      });

      const observation = makeObservation({
        taskId: taskId || 'unknown',
        source: 'tool',
        title: 'CODEX_TASK_PACK 生成',
        content: `生成任务包: ${codexTaskPack.tasks.length} 个任务, ${codexTaskPack.implementationSteps.length} 个步骤`,
        evidence: [
          `目标: ${codexTaskPack.objective}`,
          `约束: ${codexTaskPack.constraints.length} 条`,
          `文件计划: ${codexTaskPack.filePlan.length} 个文件`,
        ],
        risks: [],
        nextSuggestion: '任务包已生成，建议校验后交付',
      });

      return {
        success: true,
        message: `CODEX_TASK_PACK 生成完成: ${codexTaskPack.tasks.length} 个任务`,
        data: { codexTaskPack },
        observation,
      };
    } catch (err) {
      return {
        success: false,
        message: `CODEX_TASK_PACK 生成失败: ${err instanceof Error ? err.message : 'unknown'}`,
      };
    }
  },
};

// ─── Tool 8: validateCodexTaskPackTool ──────────────────────────────────────

const validateCodexTaskPackTool: TaskGraphToolDef = {
  name: 'validateCodexTaskPackTool',
  description: '校验 CodexTaskPack 的完整性和安全性',
  permissionLevel: 'read',
  sideEffect: 'none',
  requiresApproval: false,
  inputSchema: {},
  outputSchema: { valid: 'boolean', issues: 'string[]', suggestions: 'string[]' },
  execute: async ({ brief, taskId }) => {
    const issues: string[] = [];
    const suggestions: string[] = [];

    const pack = brief.finalHandoff;
    if (!pack) {
      return {
        success: false,
        message: '无法校验: finalHandoff 不存在',
      };
    }

    // Build DevSpec for validation (finalHandoff.devSpec is a string)
    const devSpec = buildDevSpec(brief);

    // Check required fields
    if (!devSpec.productGoal) issues.push('缺少 productGoal');
    if (!devSpec.p0Features?.length) issues.push('缺少 p0Features');
    if (!pack.acceptanceCriteria) issues.push('缺少 acceptanceCriteria');

    // Check for forbidden content
    const devSpecText = JSON.stringify(devSpec);
    const forbiddenTerms = ['删除 src/', '删除 node_modules', 'rm -rf', '格式化整个项目'];
    for (const term of forbiddenTerms) {
      if (devSpecText.includes(term)) {
        issues.push(`包含禁止操作: ${term}`);
      }
    }

    // Suggestions
    if (!devSpec.coreFlows?.length) suggestions.push('建议添加核心流程说明');
    if (!devSpec.risks?.length) suggestions.push('建议添加风险说明');

    const valid = issues.length === 0;

    const observation = makeObservation({
      taskId: taskId || 'unknown',
      source: 'tool',
      title: 'CODEX_TASK_PACK 校验',
      content: valid ? '校验通过' : `发现 ${issues.length} 个问题`,
      evidence: valid ? ['所有必要字段完整', '无禁止操作'] : issues,
      risks: valid ? [] : issues,
      nextSuggestion: valid ? '可以交付' : `需要修复: ${issues[0]}`,
    });

    return {
      success: true,
      message: valid ? '校验通过' : `发现 ${issues.length} 个问题`,
      data: { valid, issues, suggestions },
      observation,
    };
  },
};

// ─── Tool 9: createObservationTool ──────────────────────────────────────────

const createObservationTool: TaskGraphToolDef = {
  name: 'createObservationTool',
  description: '创建一条观察记录，将工具结果转为 Agent 可读的观察结果',
  permissionLevel: 'write_state',
  sideEffect: 'state_update',
  requiresApproval: false,
  inputSchema: { taskId: 'string', title: 'string', content: 'string', evidence: 'string[]?', risks: 'string[]?', nextSuggestion: 'string?' },
  outputSchema: { observation: 'AgentObservation' },
  execute: async ({ payload, taskId }) => {
    const observation = makeObservation({
      taskId: (payload.taskId as string) || taskId || 'unknown',
      source: 'system',
      title: (payload.title as string) || 'Observation',
      content: (payload.content as string) || '',
      evidence: (payload.evidence as string[]) || [],
      risks: (payload.risks as string[]) || [],
      nextSuggestion: (payload.nextSuggestion as string) || '',
    });

    return {
      success: true,
      message: `Observation 创建: ${observation.title}`,
      data: { observation },
      observation,
    };
  },
};

// ─── Tool 10: requestHumanApprovalTool ──────────────────────────────────────

const requestHumanApprovalTool: TaskGraphToolDef = {
  name: 'requestHumanApprovalTool',
  description: '创建人工确认请求，关键决策必须用户确认',
  permissionLevel: 'write_state',
  sideEffect: 'state_update',
  requiresApproval: false,
  inputSchema: { taskId: 'string', title: 'string', description: 'string', requiredBefore: 'string' },
  outputSchema: { approval: 'HumanApproval' },
  execute: async ({ payload, taskId }) => {
    const now = new Date().toISOString();
    const approval: HumanApproval = {
      id: generateTaskGraphId('appr'),
      taskId: (payload.taskId as string) || taskId || 'unknown',
      title: (payload.title as string) || '需要确认',
      description: (payload.description as string) || '',
      status: 'pending',
      requiredBefore: (payload.requiredBefore as string) || '',
      createdAt: now,
    };

    return {
      success: true,
      message: `已创建确认请求: ${approval.title}`,
      data: { approval },
      approval,
    };
  },
};

// ─── Tool 11: writeDecisionMemoryTool ───────────────────────────────────────

const writeDecisionMemoryTool: TaskGraphToolDef = {
  name: 'writeDecisionMemoryTool',
  description: '把关键决策写入记忆，让 Agent 记住重要决策',
  permissionLevel: 'write_state',
  sideEffect: 'state_update',
  requiresApproval: false,
  inputSchema: { type: 'string', title: 'string', content: 'string', tags: 'string[]?', sourceTaskId: 'string?' },
  outputSchema: { memory: 'AgentMemoryEntry' },
  execute: async ({ brief, payload, taskId }) => {
    try {
      const memory = addMemory({
        briefId: brief.id,
        type: (payload.type as AgentMemoryEntry['type']) || 'decision',
        title: (payload.title as string) || 'Decision',
        content: (payload.content as string) || '',
        tags: (payload.tags as string[]) || [],
        sourceTaskId: (payload.sourceTaskId as string) || taskId,
      });

      return {
        success: true,
        message: `记忆已写入: ${memory.title}`,
        data: { memory },
      };
    } catch (err) {
      return {
        success: false,
        message: `记忆写入失败: ${err instanceof Error ? err.message : 'unknown'}`,
      };
    }
  },
};

// ─── Tool 12: createSkillFromDecisionTool ───────────────────────────────────

const createSkillFromDecisionTool: TaskGraphToolDef = {
  name: 'createSkillFromDecisionTool',
  description: '把高质量决策沉淀为可复用技能',
  permissionLevel: 'write_state',
  sideEffect: 'state_update',
  requiresApproval: false,
  inputSchema: { title: 'string', triggerTags: 'string[]', applicableWhen: 'string', recommendedSteps: 'string[]', qualityChecks: 'string[]?', badCases: 'string[]?' },
  outputSchema: { skill: 'AgentSkill' },
  execute: async ({ payload }) => {
    try {
      const skill = {
        id: `skill-${Date.now().toString(36)}`,
        title: (payload.title as string) || 'New Skill',
        triggerTags: (payload.triggerTags as string[]) || [],
        applicableWhen: (payload.applicableWhen as string) || '',
        recommendedSteps: (payload.recommendedSteps as string[]) || [],
        requiredTools: [],
        qualityChecks: (payload.qualityChecks as string[]) || [],
        badCases: (payload.badCases as string[]) || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      saveSkill(skill);

      return {
        success: true,
        message: `技能已创建: ${skill.title}`,
        data: { skill },
      };
    } catch (err) {
      return {
        success: false,
        message: `技能创建失败: ${err instanceof Error ? err.message : 'unknown'}`,
      };
    }
  },
};

// ─── Tool Registry ──────────────────────────────────────────────────────────

const ALL_TOOLS: TaskGraphToolDef[] = [
  inspectBriefContextTool,
  evaluateRequirementQualityTool,
  detectAmbiguityTool,
  deriveScopeControlTool,
  generateEarsCriteriaTool,
  buildDevSpecTool,
  buildCodexTaskPackTool,
  validateCodexTaskPackTool,
  createObservationTool,
  requestHumanApprovalTool,
  writeDecisionMemoryTool,
  createSkillFromDecisionTool,
];

const toolMap = new Map<string, TaskGraphToolDef>(
  ALL_TOOLS.map(t => [t.name, t]),
);

// ─── Public API ─────────────────────────────────────────────────────────────

export function getTaskGraphTool(name: string): TaskGraphToolDef | undefined {
  return toolMap.get(name);
}

export function listTaskGraphTools(): TaskGraphToolDef[] {
  return [...ALL_TOOLS];
}

export function listTaskGraphToolNames(): string[] {
  return ALL_TOOLS.map(t => t.name);
}

export function listTaskGraphToolMetaMap(): Record<string, {
  permissionLevel: ToolPermissionLevel;
  sideEffect: ToolSideEffect;
  requiresApproval: boolean;
}> {
  const result: Record<string, {
    permissionLevel: ToolPermissionLevel;
    sideEffect: ToolSideEffect;
    requiresApproval: boolean;
  }> = {};
  for (const tool of ALL_TOOLS) {
    result[tool.name] = {
      permissionLevel: tool.permissionLevel,
      sideEffect: tool.sideEffect,
      requiresApproval: tool.requiresApproval,
    };
  }
  return result;
}

export function hasTaskGraphTool(name: string): boolean {
  return toolMap.has(name);
}
