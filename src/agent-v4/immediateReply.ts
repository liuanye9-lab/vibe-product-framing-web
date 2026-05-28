/**
 * Immediate Agent Reply — generates a real-time acknowledgement
 * BEFORE waiting for AI/runtime to complete. No API calls.
 *
 * Goal: user sees Agent response in < 100ms.
 */

interface ImmediateReplyInput {
  userMessage: string;
  currentNodeLabel: string;
  currentStatus?: string;
  pendingQuestions?: string[];
}

export function buildImmediateAgentReply(input: ImmediateReplyInput): string {
  const msg = input.userMessage.trim();
  const pending = input.pendingQuestions ?? [];

  // Action intents — fast acknowledgement
  if (msg === '继续下一步' || msg === 'continue' || msg.includes('继续')) {
    return '收到，我会推进到下一阶段。如果信息不足，我会先用低置信度假设，你可以随时修改。';
  }
  if (msg === '帮我做默认假设' || msg === 'make_assumption' || msg === '默认假设') {
    return '可以，我会先做低置信度假设，并把这些假设标出来，后面你可以随时改。';
  }
  if (msg === '先跳过' || msg === 'skip' || msg === '跳过') {
    return '已收到，我会把当前缺失项标记为跳过，并继续推进。';
  }
  if (msg.includes('生成开发文档') || msg.includes('生成交付') || msg.includes('Handoff') || msg.includes('Codex') || msg.includes('开发提示词')) {
    return '收到，我会先补齐必要假设，然后整理成可交给 Codex 的开发交付文档。';
  }

  // User is answering a pending question
  if (pending.length > 0) {
    return '我收到你的补充了，我会先检查它能不能填上当前缺口，然后判断是否还要继续追问。';
  }

  // User provided new product details
  if (msg.length > 20) {
    return '收到，我先理解你的想法，再判断当前应该补信息还是推进下一步。';
  }

  // Short message
  return '收到，让我看看当前的状态。';
}
