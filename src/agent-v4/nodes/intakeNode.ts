/**
 * Intake Node V4.1 — extract idea from user input, use slots to avoid repeat questions.
 *
 * Key change: uses SlotFillingState to track what's been asked.
 * Never asks the same slot more than twice.
 */

import type { ProductBrief } from '../../types';
import type {
  AgentGraphSession,
  AgentGraphNodeResult,
  AgentGraphCommand,
  AgentNodeId,
} from '../types';
import { generateGraphId } from '../types';
import {
  getMissingRequiredSlots,
  markSlotAsked,
  shouldAskSlot,
  getRequiredSlotStatus,
} from '../slotFilling';
import { addQuestionRecord } from '../questionLedger';

export async function runIntakeNode(input: {
  brief: ProductBrief;
  session: AgentGraphSession;
  userMessage: string;
}): Promise<AgentGraphNodeResult> {
  const session = input.session;
  const msg = input.userMessage.trim();
  let slotState = session.state.slotFilling;
  if (!slotState) {
    // should not happen, init in runtime
    const { createInitialSlotFillingState } = await import('../slotFilling');
    slotState = createInitialSlotFillingState();
  }

  const commands: AgentGraphCommand[] = [];

  // Try to extract targetUser/scenario from user message
  const intentNormal = !['继续下一步', '先跳过', '帮我做默认假设'].includes(msg);
  if (intentNormal && msg.length > 10) {
    // Simple extraction: if user provided substantial text, try to update briefing context
    commands.push({
      id: generateGraphId('cmd'),
      type: 'UPDATE_BRIEF',
      reason: '从用户消息中补充产品上下文',
      payload: {
        targetStage: 'product',
        patch: {
          targetUser: !session.state.slotFilling?.slots.targetUser?.value
            ? { value: msg.slice(0, 200), reason: '从用户输入提取' }
            : undefined,
          scenario: !session.state.slotFilling?.slots.scenario?.value
            ? { value: msg.slice(0, 200), reason: '从用户输入提取' }
            : undefined,
        },
        source: 'local-rule',
      },
    });
  }

  // Check which required slots are missing
  const missingSlots = getMissingRequiredSlots({ slotState, phase: 'intake' });
  const { assumed, skipped, answered } = getRequiredSlotStatus({ slotState, phase: 'intake' });

  // Filter to only askable slots (not asked >= 2 times)
  const askableSlots = missingSlots.filter((s) => shouldAskSlot(s));

  let reply: string;
  let nextNodeId: AgentNodeId;
  let shouldInterrupt = false;

  if (missingSlots.length === 0) {
    reply = '信息已收集。进入需求诊断阶段。';
    nextNodeId = 'demand';
    commands.push({
      id: generateGraphId('cmd'), type: 'MOVE_NODE',
      reason: 'Intake 信息充足', payload: { targetNodeId: 'demand' },
    });
  } else if (askableSlots.length === 0) {
    // All missing slots have been asked too many times → go to demand with assumptions
    reply = `这些信息还没补齐。为了不阻塞流程，已用默认假设推进。假设内容：${assumed > 0 ? `已做 ${assumed} 个假设` : ''}${skipped > 0 ? `，跳过 ${skipped} 项` : ''}。`;
    nextNodeId = 'demand';
    commands.push({
      id: generateGraphId('cmd'), type: 'MOVE_NODE',
      reason: 'Intake 已尝试但信息仍不足，用假设推进',
      payload: { targetNodeId: 'demand' },
    });
  } else if (answered >= 1 || assumed >= 1) {
    // Some info exists but some slots are fresh → ask concisely
    const toAsk = askableSlots.slice(0, 1); // ask at most 1 new question
    const slotNames = toAsk.map((s) => s.label).join('、');

    let newSlotState = slotState;
    for (const s of toAsk) {
      newSlotState = markSlotAsked({ slotState: newSlotState, key: s.key });
      const recordResult = addQuestionRecord({ state: { ...session.state, slotFilling: newSlotState }, slotKey: s.key, question: `请补充：${s.label}` });
      if (recordResult.alreadyAsked) continue;
    }

    reply = `还缺 ${slotNames}。补充后可以进入需求分析，或说「继续下一步」用默认假设推进。`;
    nextNodeId = 'human_interrupt';
    shouldInterrupt = true;
    commands.push({
      id: generateGraphId('cmd'), type: 'ASK_USER',
      reason: `需要补充: ${slotNames}`,
      payload: { question: `请补充：${slotNames}` },
    });
  } else {
    // First time, no info at all → ask with context
    const askable = askableSlots.slice(0, 2);
    const slotNames = askable.map((s) => s.label).join('、');

    let newSlotState = slotState;
    const questions: string[] = [];
    for (const s of askable) {
      newSlotState = markSlotAsked({ slotState: newSlotState, key: s.key });
      questions.push(`请补充：${s.label}`);
      addQuestionRecord({ state: { ...session.state, slotFilling: newSlotState }, slotKey: s.key, question: `请补充：${s.label}` });
    }

    reply = `这个想法可以继续！现在还缺 ${slotNames}。你可以补充，也可以让我先做低置信度假设。`;

    // V4.1: offer action card version
    if (askable.length >= 2) {
      reply = `这个想法可以继续，但现在还缺 ${slotNames}。\n\n你可以逐项补充，或点击下方按钮推进。`;
    }

    nextNodeId = 'human_interrupt';
    shouldInterrupt = true;
    commands.push({
      id: generateGraphId('cmd'), type: 'ASK_USER',
      reason: `需要 ${slotNames}`,
      payload: { question: `请补充：${slotNames}` },
    });
  }

  return {
    nodeId: 'intake', reply, commands, nextNodeId,
    shouldInterrupt, confidence: 0.75,
  };
}
