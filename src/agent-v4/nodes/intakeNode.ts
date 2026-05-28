/**
 * Intake Node — extract core idea, target user, scenario, problem.
 */

import type { ProductBrief } from '../../types';
import type {
  AgentGraphSession,
  AgentGraphNodeResult,
  AgentGraphCommand,
  AgentNodeId,
} from '../types';
import { generateGraphId } from '../types';

export async function runIntakeNode(input: {
  brief: ProductBrief;
  session: AgentGraphSession;
  userMessage: string;
}): Promise<AgentGraphNodeResult> {
  const { brief, userMessage } = input;
  const msg = userMessage.trim();

  const hasRawIdea = Boolean(brief.rawIdea || brief.ideaInput?.rawIdea);
  const hasTargetUser = Boolean(brief.ideaInput?.targetUser);
  const hasScenario = Boolean(brief.ideaInput?.scenario);
  const hasProblem = Boolean(brief.ideaInput?.problem);

  const commands: AgentGraphCommand[] = [];
  const missingFields: string[] = [];

  if (!hasTargetUser) missingFields.push('目标用户');
  if (!hasScenario) missingFields.push('使用场景');
  if (!hasProblem) missingFields.push('核心问题');

  // If user provided info in the message, create UPDATE_BRIEF commands
  if (!hasTargetUser && msg.length > 5) {
    commands.push({
      id: generateGraphId('cmd'),
      type: 'UPDATE_BRIEF',
      reason: '从用户消息中抽取目标用户',
      payload: {
        targetStage: 'product',
        patch: {
          targetUser: { value: msg.slice(0, 100), reason: '从用户输入中提取' },
        },
        source: 'local-rule',
      },
    });
  }

  // Update working memory
  commands.push({
    id: generateGraphId('cmd'),
    type: 'CALL_TOOL',
    reason: '保存 intake 分析到 working memory',
    payload: {
      toolName: 'updateBriefStage',
      targetStage: 'product',
      patch: {
        targetUser: hasTargetUser
          ? undefined
          : { value: brief.ideaInput?.targetUser || msg.slice(0, 100) },
        scenario: hasScenario
          ? undefined
          : { value: brief.ideaInput?.scenario || msg.slice(0, 100) },
      },
      source: 'local-rule',
    },
  });

  let reply: string;
  let nextNodeId: AgentNodeId;
  let shouldInterrupt = false;

  if (missingFields.length === 0) {
    reply = `信息看起来比较清晰了。产品想法：「${brief.rawIdea?.slice(0, 80) || msg.slice(0, 80)}」。可以开始需求诊断。`;
    nextNodeId = 'demand';
    commands.push({
      id: generateGraphId('cmd'),
      type: 'MOVE_NODE',
      reason: 'Intake 信息充足，推进到需求诊断',
      payload: { targetNodeId: 'demand' },
    });
  } else if (hasRawIdea) {
    reply = `你的想法我了解了。在我深入分析之前，想确认几个信息：${missingFields.join('、')}。你可以补充，或说「帮我做默认假设」让我基于经验推断。`;
    nextNodeId = 'human_interrupt';
    shouldInterrupt = true;
    commands.push({
      id: generateGraphId('cmd'),
      type: 'INTERRUPT_FOR_USER',
      reason: `缺少关键信息: ${missingFields.join(', ')}`,
      payload: { missingFields },
    });
  } else {
    reply = '请先描述你想做的产品。不用很详细，简单说说你想解决什么问题、给谁用。';
    nextNodeId = 'human_interrupt';
    shouldInterrupt = true;
    commands.push({
      id: generateGraphId('cmd'),
      type: 'INTERRUPT_FOR_USER',
      reason: '缺少产品想法描述',
      payload: { missingFields: ['rawIdea'] },
    });
  }

  return {
    nodeId: 'intake',
    reply,
    commands,
    nextNodeId,
    shouldInterrupt,
    confidence: missingFields.length === 0 ? 0.9 : 0.5,
  };
}
