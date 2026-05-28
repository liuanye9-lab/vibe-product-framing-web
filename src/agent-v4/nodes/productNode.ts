/**
 * Product Node — generate product one-liner, AI value, core scenarios.
 */

import type { ProductBrief } from '../../types';
import type {
  AgentGraphSession,
  AgentGraphNodeResult,
  AgentGraphCommand,
} from '../types';
import { generateGraphId } from '../types';
import { getDefaultNextNode } from '../graph';

export async function runProductNode(input: {
  brief: ProductBrief;
  session: AgentGraphSession;
  userMessage: string;
}): Promise<AgentGraphNodeResult> {
  const { brief } = input;
  const rawIdea = brief.rawIdea || brief.ideaInput?.rawIdea || '这个产品';
  const targetUser = brief.ideaInput?.targetUser || '目标用户';
  const scenario = brief.ideaInput?.scenario || '使用场景';

  const commands: AgentGraphCommand[] = [];

  // Generate product one-liner
  const productOneLiner = `面向${targetUser}的${rawIdea.slice(0, 30)}，帮他们在${scenario}时高效解决问题。`;

  commands.push({
    id: generateGraphId('cmd'),
    type: 'UPDATE_BRIEF',
    reason: '生成产品一句话定义',
    payload: {
      targetStage: 'product',
      patch: {
        productOneLiner: { value: productOneLiner, reason: '基于用户输入生成' },
        aiValue: {
          value: 'AI 介入在产品定义、范围收敛、技术路径判断和交付文档生成环节，帮用户补齐专业判断。',
          reason: '产品本身的核心价值',
        },
      },
      source: 'local-rule',
    },
  });

  // Create finding
  commands.push({
    id: generateGraphId('cmd'),
    type: 'CREATE_FINDING',
    reason: '产品定义完成',
    payload: {
      title: '产品核心定义',
      summary: productOneLiner,
      nodeId: 'product',
      evidence: [`目标用户: ${targetUser}`, `场景: ${scenario}`],
      risks: ['如果目标用户过宽，产品定位会模糊'],
      missingInfo: [],
      suggestions: ['用一句话和 3 个目标用户确认这句话是否准确'],
      confidence: 0.8,
    },
  });

  const reply = `产品核心定义：

"${productOneLiner}"

AI 价值点：帮助用户在开发前完成产品、技术、范围三方面的结构化分析，避免边写代码边改方案。

接下来我们收敛 MVP 范围。`;

  const nextNodeId = getDefaultNextNode('product');

  commands.push({
    id: generateGraphId('cmd'),
    type: 'MOVE_NODE',
    reason: '产品定义完成',
    payload: { targetNodeId: nextNodeId },
  });

  return {
    nodeId: 'product',
    reply,
    commands,
    nextNodeId,
    shouldInterrupt: false,
    confidence: 0.8,
  };
}
