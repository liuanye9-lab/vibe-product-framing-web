/**
 * MVP Node — define Must Have, Out of Scope, Minimum Loop. Detect scope creep.
 */

import type { ProductBrief } from '../../types';
import type {
  AgentGraphSession,
  AgentGraphNodeResult,
  AgentGraphCommand,
  AgentNodeId,
} from '../types';
import { generateGraphId } from '../types';
import { getDefaultNextNode } from '../graph';
import { detectScopeCreep } from '../../api/evaluate';

export async function runMvpNode(input: {
  brief: ProductBrief;
  session: AgentGraphSession;
  userMessage: string;
}): Promise<AgentGraphNodeResult> {
  const { brief } = input;
  const rawIdea = brief.rawIdea || brief.ideaInput?.rawIdea || '产品';
  const projectType = brief.ideaInput?.projectType || 'Web App';

  const allText = [brief.rawIdea, brief.ideaInput?.problem, brief.ideaInput?.scenario]
    .filter(Boolean).join(' ');
  const creepTerms = detectScopeCreep(allText);

  const commands: AgentGraphCommand[] = [];

  // Build must-have based on project type
  const mustHaves: string[] = [
    '用户可以输入或编辑核心想法',
    '系统生成关键结构化结果',
    '用户可以复制或下载最终交付文档',
  ];
  if (projectType.includes('管理') || projectType.includes('track')) {
    mustHaves.push('核心数据管理（增删改查）');
  }

  const outOfScope: string[] = [
    '登录/注册',
    '支付系统',
    '团队协作',
    '复杂后台',
    '自动部署流水线',
  ];

  commands.push({
    id: generateGraphId('cmd'),
    type: 'UPDATE_BRIEF',
    reason: '生成 MVP 范围定义',
    payload: {
      targetStage: 'mvp',
      patch: {
        mustHave: { value: mustHaves, reason: '基于产品类型和用户输入生成的 MVP 核心功能' },
        outOfScope: { value: outOfScope, reason: 'V1 不应包含的功能范围' },
        minimumLoop: {
          value: `用户输入"${rawIdea.slice(0, 50)}"，系统生成核心分析，用户确认后得到可交付的开发文档。`,
          reason: '最小闭环 — 用户必须能走完核心流程',
        },
        scopeCreepWarning: creepTerms.length
          ? `发现范围膨胀词：${creepTerms.join('、')}。V1 建议压缩为一个核心闭环。`
          : undefined,
      },
      source: 'local-rule',
    },
  });

  // Scope creep finding
  if (creepTerms.length > 0) {
    commands.push({
      id: generateGraphId('cmd'),
      type: 'CREATE_FINDING',
      reason: '检测到范围膨胀风险',
      payload: {
        title: '范围膨胀警告',
        summary: `检测到以下范围膨胀词：${creepTerms.join('、')}。建议 V1 只保留核心闭环功能。`,
        nodeId: 'mvp',
        risks: ['范围膨胀会导致 V1 开发周期过长，无法快速验证'],
        confidence: 0.9,
      },
    });
  }

  const reply = `MVP 范围分析：

必做功能（Must Have）：
${mustHaves.map((m, i) => `${i + 1}. ${m}`).join('\n')}

不做（Out of Scope）：
${outOfScope.map((o, i) => `${i + 1}. ${o}`).join('\n')}

最小闭环：用户输入想法 → 系统分析 → 用户确认 → 输出交付文档。
${creepTerms.length ? `\n⚠️ 范围膨胀风险：${creepTerms.join('、')}` : ''}

接下来分析技术实现方案。`;

  const nextNodeId: AgentNodeId = getDefaultNextNode('mvp');

  commands.push({
    id: generateGraphId('cmd'),
    type: 'MOVE_NODE',
    reason: 'MVP 范围已定义',
    payload: { targetNodeId: nextNodeId },
  });

  return {
    nodeId: 'mvp',
    reply,
    commands,
    nextNodeId,
    shouldInterrupt: false,
    confidence: 0.85,
  };
}
