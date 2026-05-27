/**
 * Agent V3 Intent Parser
 *
 * Detects user intent from natural language input.
 * Intent detection takes priority over missing-field checks.
 */

export type UserIntent =
  | 'normal'
  | 'continue'
  | 'skip'
  | 'make_assumption'
  | 'go_back'
  | 'edit_previous'
  | 'generate_handoff'
  | 'ask_why'
  | 'answer_question'
  | 'restart_phase';

export function parseUserIntent(message: string): UserIntent {
  const m = message.toLowerCase().trim();

  // Short exact matches first
  if (m === '继续' || m === '下一步' || m === '进入下一步' || m === 'continue' || m === '推进') return 'continue';
  if (m === '跳过' || m === '先跳过' || m === 'skip' || m === '先不回答') return 'skip';
  if (m === '回到上一阶段' || m === '回到上一步' || m === 'go_back' || m === '回退') return 'go_back';

  // Contains matches
  if (m.includes('假设') || m.includes('你来决定') || m === '帮我做默认假设' ||
    m === '我不确定' || m === '你帮我定' || m === 'make_assumption') return 'make_assumption';

  if (m.includes('生成') && (m.includes('handoff') || m.includes('开发文档') || m.includes('交付') ||
    m.includes('codex') || m.includes('prompt'))) return 'generate_handoff';

  if (m.includes('为什么') || m.includes('解释') || m.includes('原因') || m === 'ask_why') return 'ask_why';

  if (m.includes('修改') || m.includes('改一下') || m.startsWith('我想改') || m.includes('edit')) return 'edit_previous';

  if (m.startsWith('我回答') || m.startsWith('answer_question')) return 'answer_question';

  if (m.includes('重新') && (m.includes('分析') || m.includes('阶段') || m.includes('restart'))) return 'restart_phase';

  if (m.includes('回到') && (m.includes('mvp') || m.includes('技术') || m.includes('需求') ||
    m.includes('产品'))) return 'go_back';

  // Check for implicit continue/skip patterns
  if (m === '好' || m === '好的' || m === 'ok' || m === '可以' || m === '是的' || m === 'yes' || m === '行') return 'continue';
  if (m === '不知道' || m === '不清楚' || m === '不确定' || m === 'unsure') return 'make_assumption';

  return 'normal';
}
