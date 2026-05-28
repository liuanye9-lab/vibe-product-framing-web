/**
 * Prompt Contracts V4 — per-agent mission, commands, and output schema.
 */

import type { AgentNodeId } from '../types';

export interface AgentContract {
  nodeId: AgentNodeId;
  mission: string;
  allowedCommands: string[];
  forbiddenCommands: string[];
  requiredEvidence: string[];
  outputSchema: Record<string, unknown>;
}

export const AGENT_CONTRACTS: Record<string, AgentContract> = {
  orchestrator: {
    nodeId: 'orchestrator',
    mission: '解析用户意图，判断当前状态是否足够推进，选择下一个合适的节点。不直接生成完整业务内容。',
    allowedCommands: ['ASK_USER', 'MOVE_NODE', 'CREATE_FINDING', 'CREATE_TASK', 'INTERRUPT_FOR_USER'],
    forbiddenCommands: ['UPDATE_BRIEF', 'GENERATE_HANDOFF', 'EVALUATE_HANDOFF', 'CREATE_MEMORY', 'CREATE_SKILL'],
    requiredEvidence: ['userGoal', 'currentNodeId'],
    outputSchema: {
      type: 'object',
      properties: {
        reply: { type: 'string' },
        commands: { type: 'array', maxItems: 2 },
        nextNodeId: { type: 'string' },
        shouldInterrupt: { type: 'boolean' },
      },
      required: ['reply'],
    },
  },

  intake: {
    nodeId: 'intake',
    mission: '从用户想法中抽取 rawIdea、targetUser、scenario、problem、projectType。信息不足时追问用户。',
    allowedCommands: ['ASK_USER', 'UPDATE_BRIEF', 'CREATE_FINDING', 'MOVE_NODE', 'INTERRUPT_FOR_USER'],
    forbiddenCommands: ['GENERATE_HANDOFF', 'EVALUATE_HANDOFF', 'CREATE_MEMORY', 'CREATE_SKILL'],
    requiredEvidence: ['rawIdea'],
    outputSchema: {
      type: 'object',
      properties: {
        reply: { type: 'string' },
        extractedFields: {
          type: 'object',
          properties: {
            targetUser: { type: 'string' },
            scenario: { type: 'string' },
            problem: { type: 'string' },
            projectType: { type: 'string' },
          },
        },
        missingFields: { type: 'array', items: { type: 'string' } },
        commands: { type: 'array', maxItems: 3 },
      },
    },
  },

  demand: {
    nodeId: 'demand',
    mission: '判断目标用户、场景、痛点、替代方案、需求证据是否充分。缺信息追问，信息足推进。',
    allowedCommands: ['ASK_USER', 'UPDATE_BRIEF', 'CREATE_FINDING', 'MOVE_NODE', 'CREATE_TASK', 'INTERRUPT_FOR_USER'],
    forbiddenCommands: ['GENERATE_HANDOFF', 'EVALUATE_HANDOFF'],
    requiredEvidence: ['targetUser', 'scenario', 'problem'],
    outputSchema: {
      type: 'object',
      properties: {
        reply: { type: 'string' },
        findings: { type: 'array' },
        commands: { type: 'array', maxItems: 3 },
      },
    },
  },

  product: {
    nodeId: 'product',
    mission: '生成产品一句话定义、AI 价值、核心使用场景，更新 product stage。',
    allowedCommands: ['UPDATE_BRIEF', 'CREATE_FINDING', 'MOVE_NODE', 'ASK_USER'],
    forbiddenCommands: ['GENERATE_HANDOFF', 'EVALUATE_HANDOFF'],
    requiredEvidence: ['productOneLiner', 'aiValue'],
    outputSchema: {
      type: 'object',
      properties: {
        reply: { type: 'string' },
        productOneLiner: { type: 'string' },
        aiValue: { type: 'string' },
        commands: { type: 'array', maxItems: 2 },
      },
    },
  },

  mvp: {
    nodeId: 'mvp',
    mission: '生成 Must Have、Out of Scope、Minimum Loop。检测 scope creep。',
    allowedCommands: ['UPDATE_BRIEF', 'CREATE_FINDING', 'CREATE_TASK', 'MOVE_NODE', 'ASK_USER'],
    forbiddenCommands: ['GENERATE_HANDOFF', 'EVALUATE_HANDOFF'],
    requiredEvidence: ['mustHave', 'outOfScope', 'minimumLoop'],
    outputSchema: {
      type: 'object',
      properties: {
        reply: { type: 'string' },
        mustHave: { type: 'array' },
        outOfScope: { type: 'array' },
        minimumLoop: { type: 'string' },
        scopeCreepWarning: { type: 'string' },
        commands: { type: 'array', maxItems: 2 },
      },
    },
  },

  tech: {
    nodeId: 'tech',
    mission: '判断最低成本技术路径：是否需要后端、数据库、AI API、文件上传、认证。给出 mock 策略和升级条件。',
    allowedCommands: ['UPDATE_BRIEF', 'CREATE_FINDING', 'MOVE_NODE', 'ASK_USER'],
    forbiddenCommands: ['GENERATE_HANDOFF', 'EVALUATE_HANDOFF'],
    requiredEvidence: ['frontend', 'mockStrategy'],
    outputSchema: {
      type: 'object',
      properties: {
        reply: { type: 'string' },
        frontend: { type: 'string' },
        backend: { type: 'string' },
        database: { type: 'string' },
        mockStrategy: { type: 'string' },
        commands: { type: 'array', maxItems: 2 },
      },
    },
  },

  risk: {
    nodeId: 'risk',
    mission: '审查需求风险、技术风险、商业风险、范围风险。生成反证和调整建议。',
    allowedCommands: ['UPDATE_BRIEF', 'CREATE_FINDING', 'MOVE_NODE', 'ASK_USER'],
    forbiddenCommands: ['GENERATE_HANDOFF'],
    requiredEvidence: ['risks', 'whatWouldProveWrong'],
    outputSchema: {
      type: 'object',
      properties: {
        reply: { type: 'string' },
        risks: { type: 'array' },
        whatWouldProveWrong: { type: 'array' },
        commands: { type: 'array', maxItems: 2 },
      },
    },
  },

  handoff: {
    nodeId: 'handoff',
    mission: '整合所有阶段信息，生成 Developer Handoff 交付文档。',
    allowedCommands: ['GENERATE_HANDOFF', 'MOVE_NODE', 'ASK_USER'],
    forbiddenCommands: ['EVALUATE_HANDOFF'],
    requiredEvidence: ['developmentPrompt'],
    outputSchema: {
      type: 'object',
      properties: {
        reply: { type: 'string' },
        commands: { type: 'array', maxItems: 2 },
      },
    },
  },

  reviewer: {
    nodeId: 'reviewer',
    mission: '评估 Handoff 质量。分数不足交给 reflection，达标则完成。',
    allowedCommands: ['EVALUATE_HANDOFF', 'MOVE_NODE', 'CREATE_FINDING', 'CREATE_TASK', 'INTERRUPT_FOR_USER'],
    forbiddenCommands: ['GENERATE_HANDOFF', 'UPDATE_BRIEF'],
    requiredEvidence: ['evaluation'],
    outputSchema: {
      type: 'object',
      properties: {
        reply: { type: 'string' },
        readiness: { type: 'string' },
        score: { type: 'number' },
        commands: { type: 'array', maxItems: 2 },
      },
    },
  },

  reflection: {
    nodeId: 'reflection',
    mission: '总结失败原因、被拒绝的判断、生成反思记忆和可复用 skill。不需要每轮调用 AI。',
    allowedCommands: ['CREATE_MEMORY', 'CREATE_SKILL', 'MOVE_NODE', 'CREATE_FINDING'],
    forbiddenCommands: ['UPDATE_BRIEF', 'GENERATE_HANDOFF', 'EVALUATE_HANDOFF'],
    requiredEvidence: [],
    outputSchema: {
      type: 'object',
      properties: {
        reply: { type: 'string' },
        reflections: { type: 'array' },
        skills: { type: 'array' },
        commands: { type: 'array', maxItems: 2 },
      },
    },
  },
};
