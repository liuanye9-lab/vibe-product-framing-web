/**
 * Agent V3 Prompt Builder
 *
 * Builds system and user prompts for each Agent role.
 * All Agents must return JSON in the standard V3 format.
 */

import type { AgentRole } from './types';
import { AGENT_CONTRACTS, type AgentContract } from './agentContracts';

const JSON_FORMAT_TEMPLATE = `返回格式必须是纯 JSON（不要 markdown 代码块，不要解释文字，不要外层包裹）：
{
  "reply": "给用户看的自然语言回复（像产品经理协作，不要像报告）",
  "commands": [
    {
      "type": "ask_user | update_brief | create_finding | create_task | complete_task | move_phase | set_status | generate_handoff | evaluate_handoff | show_warning | wait_for_user_confirmation",
      "reason": "为什么执行这个动作",
      "payload": {}
    }
  ],
  "actionCards": [
    {
      "type": "question | decision | warning | next_step | patch_preview | handoff_ready",
      "title": "卡片标题",
      "description": "卡片描述",
      "actions": [
        {
          "id": "action-id",
          "label": "按钮文字",
          "intent": "answer | accept | reject | continue | skip | make_assumption | edit | generate_handoff | go_phase",
          "value": "可选值"
        }
      ]
    }
  ],
  "questions": ["最多2个追问"],
  "confidence": 0.8
}`;

const CORE_RULES = `核心规则：
1. 只返回 JSON，不要 markdown，不要外层 result/data/output 包裹。
2. 如果信息不足，优先 ask_user，不要一次性生成完整方案。
3. 每轮最多 3 个 commands。
4. 每轮最多 2 个 actionCards。
5. 每轮最多 2 个 questions。
6. commands 只能用你被允许的类型。
7. 不允许无理由 move_phase。
8. 不允许覆盖 editedByUser=true 的字段。
9. reply 要像产品经理协作，不要像报告。
10. 所有输出必须基于当前 context。`;

export function buildAgentV3SystemPrompt(role: AgentRole): string {
  const contract = AGENT_CONTRACTS[role];
  if (!contract) {
    return `你是 Vibe Copilot 通用 Agent。${CORE_RULES}\n${JSON_FORMAT_TEMPLATE}`;
  }

  const allowedCmds = contract.allowedCommands.join(', ');
  const forbidden = contract.forbiddenBehaviors.map((b) => `- ${b}`).join('\n');
  const outputRules = contract.outputRules.map((r) => `- ${r}`).join('\n');

  return `你是 Vibe Copilot 的 ${contract.name}（${role}）。
你的使命：${contract.mission}

你被允许的命令类型：${allowedCmds}

禁止行为：
${forbidden}

输出规则：
${outputRules}

${CORE_RULES}

${JSON_FORMAT_TEMPLATE}`;
}

export function buildAgentV3UserPrompt(input: {
  role: AgentRole;
  context: string;
  contract: AgentContract;
}): string {
  const { role, context, contract } = input;
  return `作为 ${contract.name}（${role}），根据以下上下文做出判断：

${context}

请基于当前信息做出决策。如果信息不足，优先生成 ask_user command。
如果信息充足，可以 move_phase 推进。`;
}
