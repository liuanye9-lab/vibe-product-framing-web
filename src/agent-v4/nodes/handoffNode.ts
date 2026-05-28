/**
 * Handoff Node — generate Developer Handoff document.
 */

import type { ProductBrief } from '../../types';
import type {
  AgentGraphSession,
  AgentGraphNodeResult,
  AgentGraphCommand,
} from '../types';
import { generateGraphId } from '../types';
import { getDefaultNextNode } from '../graph';

export async function runHandoffNode(_input: {
  brief: ProductBrief;
  session: AgentGraphSession;
  userMessage: string;
}): Promise<AgentGraphNodeResult> {
  void _input.userMessage; // unused in local-only handoff
  const commands: AgentGraphCommand[] = [];

  // Generate local handoff
  commands.push({
    id: generateGraphId('cmd'),
    type: 'GENERATE_HANDOFF',
    reason: '整合所有阶段生成开发交付文档',
    payload: {},
  });

  const reply = '正在为你整合所有阶段的信息，生成 Developer Handoff 交付文档...\n\n生成完成后，Reviewer 会自动评估交付质量。';

  const nextNodeId = getDefaultNextNode('handoff');

  commands.push({
    id: generateGraphId('cmd'),
    type: 'MOVE_NODE',
    reason: 'Handoff 生成完成，进入审查',
    payload: { targetNodeId: nextNodeId },
  });

  return {
    nodeId: 'handoff',
    reply,
    commands,
    nextNodeId,
    shouldInterrupt: false,
    confidence: 0.9,
  };
}
