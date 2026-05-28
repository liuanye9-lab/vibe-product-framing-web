/**
 * Demand Node — validate demand signals.
 */

import type { ProductBrief } from '../../types';
import type {
  AgentGraphSession,
  AgentGraphNodeResult,
  AgentGraphCommand,
} from '../types';
import { generateGraphId } from '../types';
import { getDefaultNextNode } from '../graph';

export async function runDemandNode(input: {
  brief: ProductBrief;
  session: AgentGraphSession;
  userMessage: string;
}): Promise<AgentGraphNodeResult> {
  const { brief } = input;
  const targetUser = brief.ideaInput?.targetUser || '用户';
  const scenario = brief.ideaInput?.scenario || '使用场景';
  const problem = brief.ideaInput?.problem || '核心问题';

  const commands: AgentGraphCommand[] = [];

  // Create a demand finding
  commands.push({
    id: generateGraphId('cmd'),
    type: 'CREATE_FINDING',
    reason: '需求信号分析',
    payload: {
      title: '需求初步判断',
      summary: `面向 ${targetUser}，在 ${scenario} 时需要解决 ${problem}。需求信号偏中高，值得做 MVP 验证。`,
      nodeId: 'demand',
      evidence: [
        `目标用户: ${targetUser}`,
        `使用场景: ${scenario}`,
        `核心问题: ${problem}`,
      ],
      risks: [
        '如果目标用户过宽，MVP 会失焦',
        '需要实际用户验证痛点频率',
      ],
      missingInfo: brief.ideaInput?.targetUser ? [] : ['目标用户需要更具体'],
      suggestions: ['找 3-5 个目标用户做轻量验证'],
      confidence: 0.7,
    },
  });

  // Create tasks
  commands.push({
    id: generateGraphId('cmd'),
    type: 'CREATE_TASK',
    reason: '需求阶段需要验证用户画像',
    payload: {
      title: '具体化目标用户画像',
      description: `补充 ${targetUser} 的经验水平、当前替代方案、使用频率`,
      required: true,
    },
  });

  const reply = `需求信号分析完成。

目标用户：${targetUser}
使用场景：${scenario}
核心问题：${problem}

基于目前信息，需求信号偏中高。接下来我们定义产品核心价值。`;

  const nextNodeId = getDefaultNextNode('demand');

  commands.push({
    id: generateGraphId('cmd'),
    type: 'MOVE_NODE',
    reason: '需求分析完成，进入产品定义',
    payload: { targetNodeId: nextNodeId },
  });

  return {
    nodeId: 'demand',
    reply,
    commands,
    nextNodeId,
    shouldInterrupt: false,
    confidence: 0.75,
  };
}
