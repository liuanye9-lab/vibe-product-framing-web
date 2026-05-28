/**
 * Orchestrator Node — intent routing and node selection.
 *
 * The orchestrator does NOT generate full business content.
 * It parses intent and routes to the appropriate business node.
 */

import type { ProductBrief } from '../../types';
import type {
  AgentGraphSession,
  AgentGraphNodeResult,
  AgentGraphCommand,
  AgentNodeId,
} from '../types';
import { generateGraphId } from '../types';
import { canTransition, getDefaultNextNode } from '../graph';

const NODE_MENTIONS: Record<string, AgentNodeId> = {
  'intake': 'intake',
  '想法': 'intake',
  '输入': 'intake',
  'demand': 'demand',
  '需求': 'demand',
  'product': 'product',
  '产品': 'product',
  'mvp': 'mvp',
  '范围': 'mvp',
  '功能': 'mvp',
  'tech': 'tech',
  '技术': 'tech',
  'risk': 'risk',
  '风险': 'risk',
  'handoff': 'handoff',
  '交付': 'handoff',
  '开发文档': 'handoff',
  '文档': 'handoff',
  'review': 'reviewer',
  '审查': 'reviewer',
  'reflection': 'reflection',
  '反思': 'reflection',
};

function detectNodeFromMessage(message: string): AgentNodeId | null {
  const lower = message.toLowerCase();
  for (const [keyword, nodeId] of Object.entries(NODE_MENTIONS)) {
    if (lower.includes(keyword.toLowerCase())) return nodeId;
  }
  return null;
}

function detectIntent(message: string): 'ask_user' | 'continue' | 'skip' | 'handoff' | 'normal' {
  const m = message.toLowerCase();
  if (m.includes('继续') || m.includes('下一步') || m.includes('推进')) return 'continue';
  if (m.includes('跳过') || m.includes('skip')) return 'skip';
  if (m.includes('默认假设') || m.includes('假设') || m.includes('帮我填')) return 'continue';
  if (m.includes('handoff') || m.includes('开发文档') || m.includes('交付') || m.includes('dev spec')) return 'handoff';
  if (m.includes('?') || m.includes('？') || m.includes('什么') || m.includes('怎么') || m.includes('如何')) return 'ask_user';
  return 'normal';
}

export async function runOrchestratorNode(input: {
  brief: ProductBrief;
  session: AgentGraphSession;
  userMessage: string;
}): Promise<AgentGraphNodeResult> {
  const { brief, session, userMessage } = input;
  const msg = userMessage.trim();
  const currentNodeId = session.state.currentNodeId;
  const intent = detectIntent(msg);
  const mentionedNode = detectNodeFromMessage(msg);

  const commands: AgentGraphCommand[] = [];
  let nextNodeId: AgentNodeId | undefined;
  let reply = '';
  let shouldInterrupt = false;

  switch (intent) {
    case 'continue': {
      nextNodeId = getDefaultNextNode(currentNodeId);
      if (currentNodeId === 'end') {
        reply = '工作流已完成。如需修改，请告诉我具体哪个阶段需要调整。';
        break;
      }
      if (canTransition(currentNodeId, nextNodeId)) {
        commands.push({
          id: generateGraphId('cmd'),
          type: 'MOVE_NODE',
          reason: '用户选择继续推进',
          payload: { targetNodeId: nextNodeId },
        });
        reply = `推进到下一节点。`;
      }
      break;
    }
    case 'skip': {
      nextNodeId = getDefaultNextNode(currentNodeId);
      if (canTransition(currentNodeId, nextNodeId)) {
        commands.push({
          id: generateGraphId('cmd'),
          type: 'MOVE_NODE',
          reason: '用户选择跳过当前节点',
          payload: { targetNodeId: nextNodeId },
        });
        reply = `跳过当前节点，进入下一阶段。`;
      }
      break;
    }
    case 'handoff': {
      if (canTransition(currentNodeId, 'handoff')) {
        commands.push({
          id: generateGraphId('cmd'),
          type: 'MOVE_NODE',
          reason: '用户请求直接生成交付文档',
          payload: { targetNodeId: 'handoff' },
        });
        reply = '正在为你生成 Developer Handoff...';
        nextNodeId = 'handoff';
      } else {
        reply = '当前阶段还不能直接生成交付文档，先完成前面的分析。';
        shouldInterrupt = true;
      }
      break;
    }
    case 'ask_user':
    default: {
      // Route to mentioned node or stay on current
      if (mentionedNode && canTransition(currentNodeId, mentionedNode)) {
        commands.push({
          id: generateGraphId('cmd'),
          type: 'MOVE_NODE',
          reason: `用户提到 ${mentionedNode} 相关内容`,
          payload: { targetNodeId: mentionedNode },
        });
        nextNodeId = mentionedNode;
        reply = `路由到 ${mentionedNode} 节点处理。`;
      } else if (intent === 'ask_user') {
        // User has a question — route to appropriate node
        const targetNode = mentionedNode || currentNodeId;
        reply = `交给 ${targetNode} 节点处理你的问题。`;
        nextNodeId = targetNode;
      } else {
        // New user input — assess if we need intake
        if (currentNodeId === 'end') {
          reply = '工作流已完成。如需重新开始分析请告知。';
        } else if (!brief.ideaInput?.targetUser && !brief.ideaInput?.scenario) {
          nextNodeId = 'intake';
          commands.push({
            id: generateGraphId('cmd'),
            type: 'MOVE_NODE',
            reason: '产品信息不足，进入 intake',
            payload: { targetNodeId: 'intake' },
          });
          reply = '让我们先了解你的产品想法。';
        } else {
          reply = '我会基于你的输入继续推进。';
        }
      }
      break;
    }
  }

  return {
    nodeId: 'orchestrator',
    reply,
    commands,
    nextNodeId: nextNodeId || currentNodeId,
    shouldInterrupt,
    confidence: 0.8,
  };
}
