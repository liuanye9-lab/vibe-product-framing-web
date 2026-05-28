/**
 * Reviewer Node — evaluate Handoff quality.
 */

import type { ProductBrief } from '../../types';
import type {
  AgentGraphSession,
  AgentGraphNodeResult,
  AgentGraphCommand,
} from '../types';
import { generateGraphId, type AgentNodeId } from '../types';

export async function runReviewerNode(input: {
  brief: ProductBrief;
  session: AgentGraphSession;
  userMessage: string;
}): Promise<AgentGraphNodeResult> {
  const handoff = input.brief.finalHandoff;
  const commands: AgentGraphCommand[] = [];

  if (!handoff) {
    return {
      nodeId: 'reviewer',
      reply: '尚未生成 Handoff 文档。请先生成交付文档。',
      commands: [{
        id: generateGraphId('cmd'),
        type: 'MOVE_NODE',
        reason: 'Handoff 不存在，返回 handoff 节点',
        payload: { targetNodeId: 'handoff' },
      }],
      nextNodeId: 'handoff',
      shouldInterrupt: false,
      confidence: 1,
    };
  }

  // Evaluate handoff
  commands.push({
    id: generateGraphId('cmd'),
    type: 'EVALUATE_HANDOFF',
    reason: '评估交付文档质量',
    payload: {},
  });

  const evaluation = handoff.evaluation;
  let reply: string;
  let nextNodeId: AgentNodeId;

  if (evaluation) {
    const readiness = evaluation.readiness;
    if (readiness === 'ready') {
      reply = `交付文档质量评估：${evaluation.totalScore}/${evaluation.maxScore} — 达到标准，可以交付！\n\n你的 Developer Handoff 已经可以交给 Codex / Claude Code / Cursor 开发了。`;
      nextNodeId = 'end';
    } else if (readiness === 'needs-review') {
      reply = `交付文档质量：${evaluation.totalScore}/${evaluation.maxScore} — 需要改进。让我反思一下哪些地方可以优化...`;
      nextNodeId = 'reflection';
    } else {
      reply = `交付文档质量不足：${evaluation.totalScore}/${evaluation.maxScore}。进入反思阶段，分析问题并尝试修复。`;
      nextNodeId = 'reflection';
    }
  } else {
    // No evaluation yet — generate one via tool
    reply = '正在评估交付文档质量...';
    nextNodeId = 'reflection';
  }

  commands.push({
    id: generateGraphId('cmd'),
    type: 'MOVE_NODE',
    reason: `评估结果决定路由: ${nextNodeId}`,
    payload: { targetNodeId: nextNodeId },
  });

  return {
    nodeId: 'reviewer',
    reply,
    commands,
    nextNodeId,
    shouldInterrupt: false,
    confidence: 0.8,
  };
}
