/**
 * Risk Node — demand, technical, business, and scope risk review.
 */

import type { ProductBrief } from '../../types';
import type {
  AgentGraphSession,
  AgentGraphNodeResult,
  AgentGraphCommand,
} from '../types';
import { generateGraphId } from '../types';
import { getDefaultNextNode } from '../graph';

export async function runRiskNode(input: {
  brief: ProductBrief;
  session: AgentGraphSession;
  userMessage: string;
}): Promise<AgentGraphNodeResult> {
  const { brief } = input;
  const rawIdea = brief.rawIdea || brief.ideaInput?.rawIdea || '';

  const commands: AgentGraphCommand[] = [];

  commands.push({
    id: generateGraphId('cmd'),
    type: 'UPDATE_BRIEF',
    reason: '生成风险审查',
    payload: {
      targetStage: 'blindSpot',
      patch: {
        demandRisk: {
          value: ['目标用户可能没有强烈到愿意完成完整流程的痛点', '用户可能只想直接和 AI 对话，不使用结构化工具'],
          reason: '需求风险：从反证角度看',
        },
        businessRisk: {
          value: ['如果最终 Prompt 对开发结果提升不明显，用户不会复用', '如果流程太长，完成率可能偏低'],
          reason: '业务风险：来自收益感知和完成率',
        },
        technicalRisk: {
          value: ['不同 AI API 返回格式不统一', 'localStorage 数据可能因浏览器清理丢失'],
          reason: '技术风险：V1 稳定性',
        },
        scopeRisk: {
          value: ['如果继续加入团队协作或数据库，会偏离 V1 定位'],
          reason: '范围风险：防止偏离核心',
        },
        whatWouldProveWrong: {
          value: ['5 个目标用户中少于 2 个愿意走完整流程', '用户复制最终 Prompt 后仍无法正确开发'],
          reason: '这些信号能证明方案需要调整',
        },
      },
      source: 'local-rule',
    },
  });

  commands.push({
    id: generateGraphId('cmd'),
    type: 'CREATE_FINDING',
    reason: '风险审查总结',
    payload: {
      title: '风险审查结果',
      summary: `主要风险：需求信号可能不够强、完成率可能偏低、AI 输出质量不稳定。关键反证信号：用户愿意完成流程的比例和最终开发效果。`,
      nodeId: 'risk',
      evidence: [
        `产品：${rawIdea.slice(0, 50)}`,
        '涉及 AI 生成，输出质量是关键风险',
      ],
      risks: ['需求不确定性', 'AI 输出质量', '数据持久化风险'],
      missingInfo: [],
      suggestions: ['先找 3-5 个目标用户做轻量验证', '重点关注 AI 输出的可用性'],
      confidence: 0.7,
    },
  });

  const reply = `风险审查完成：

需求风险：目标用户可能没有足够强的痛点。
技术风险：localStorage 数据丢失、AI API 不稳定。
范围风险：功能膨胀。

关键反证信号：
- 如果少于 2/5 用户愿意走完整流程 → 需要调整
- 如果最终 Prompt 无法让 AI 正确开发 → 需要调整

接下来生成开发交付文档。`;

  const nextNodeId = getDefaultNextNode('risk');

  commands.push({
    id: generateGraphId('cmd'),
    type: 'MOVE_NODE',
    reason: '风险审查完成',
    payload: { targetNodeId: nextNodeId },
  });

  return {
    nodeId: 'risk',
    reply,
    commands,
    nextNodeId,
    shouldInterrupt: false,
    confidence: 0.75,
  };
}
