/**
 * Reflection Node — analyze failures, generate memories and skills.
 *
 * Does NOT call AI every time. Uses local rules first to detect
 * patterns and generate concise reflections.
 */

import type { ProductBrief } from '../../types';
import type {
  AgentGraphSession,
  AgentGraphNodeResult,
  AgentGraphCommand,
} from '../types';
import { generateGraphId, type AgentNodeId } from '../types';

export async function runReflectionNode(input: {
  brief: ProductBrief;
  session: AgentGraphSession;
  userMessage: string;
}): Promise<AgentGraphNodeResult> {
  const { session, brief } = input;
  const commands: AgentGraphCommand[] = [];
  const reflections: string[] = [];

  // Check evaluation score
  const evaluation = session.state.lastEvaluation;
  if (evaluation && evaluation.score < 15) {
    reflections.push(
      `Handoff 评分偏低 (${evaluation.score})：主要问题 — ${evaluation.issues.slice(0, 3).join('；')}`,
    );
  }

  // Check rejected findings
  const recentFindings = session.state.findings.slice(-5);
  for (const f of recentFindings) {
    if (f.confidence < 0.5) {
      reflections.push(`低置信度判断: ${f.title} (${f.confidence})`);
    }
  }

  // Check for repeated patterns
  const pendingQuestions = session.state.pendingQuestions;
  if (pendingQuestions.length > 3) {
    reflections.push('多个问题待回答，可能需要更好的默认假设策略。');
  }

  // Create memories for reflections
  for (const r of reflections.slice(0, 3)) {
    commands.push({
      id: generateGraphId('cmd'),
      type: 'CREATE_MEMORY',
      reason: '反思记录',
      payload: {
        type: 'reflection',
        title: `Reflection: ${new Date().toLocaleDateString()}`,
        content: r,
        tags: ['reflection', session.state.currentNodeId],
        source: 'reflection',
      },
    });
  }

  // Check if we should create a skill (simplified heuristic)
  const techFindings = session.state.findings.filter((f) => f.nodeId === 'tech' || f.nodeId === 'mvp');
  if (techFindings.length >= 3 && !evaluation) {
    commands.push({
      id: generateGraphId('cmd'),
      type: 'CREATE_SKILL',
      reason: '检测到多次类似 MVP/技术判断，沉淀为 skill',
      payload: {
        title: `${brief.ideaInput?.projectType || '通用'} 项目 MVP 收敛模板`,
        triggerTags: [brief.ideaInput?.projectType || 'web', 'mvp', 'scope'],
        applicableWhen: '新项目涉及范围定义时必须收敛到核心闭环',
        recommendedSteps: [
          '列出所有功能，标记 Must/Should/Wont',
          '只保留 Must Have 中能形成闭环的功能',
          '明确 Out of Scope（登录、支付、协作）',
          '写最小用户流程（3 步以内）',
        ],
      },
    });
  }

  let reply = '反思分析完成。\n\n';
  if (reflections.length > 0) {
    reply += reflections.map((r) => `- ${r}`).join('\n');
  } else {
    reply += '当前没有需要特别反思的问题。流程推进顺利。';
  }

  // Route back to handoff or end
  let nextNodeId: AgentNodeId;
  if (evaluation && evaluation.score < 12) {
    nextNodeId = 'handoff';
    reply += '\n\n分数偏低，建议重新生成 Handoff。';
  } else {
    nextNodeId = 'end';
    reply += '\n\n工作流完成。';
  }

  commands.push({
    id: generateGraphId('cmd'),
    type: 'MOVE_NODE',
    reason: '反思完成',
    payload: { targetNodeId: nextNodeId },
  });

  return {
    nodeId: 'reflection',
    reply,
    commands,
    nextNodeId,
    shouldInterrupt: false,
    confidence: 0.7,
  };
}
