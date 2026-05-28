import type { CopilotPhase, AmbiguityIssue } from '../types';

const VAGUE_PATTERNS: Array<{ pattern: RegExp; message: string; severity: 'low' | 'medium' | 'high' }> = [
  { pattern: /智能化|自动化|智慧化/g, message: '"智能化/自动化"是模糊词，建议说明具体如何实现', severity: 'medium' },
  { pattern: /平台化|系统化|一体化/g, message: '"平台化/系统化"暗示范围可能过大', severity: 'medium' },
  { pattern: /很多|一些|大部分|比较|差不多|大概/g, message: '模糊量词会让需求边界不清晰', severity: 'medium' },
  { pattern: /好用|好用一点|方便|简单|强大|友好|流畅/g, message: '空洞形容词无法指导设计和验收', severity: 'low' },
  { pattern: /所有用户|全部功能|全平台|全覆盖/g, message: '无边界范围暗示 scope creep 风险', severity: 'high' },
  { pattern: /提升效率|提高效率|优化/g, message: '缺少具体效率和优化目标', severity: 'medium' },
  { pattern: /做一个|搞一个|弄一个/g, message: '表述过于口语化，缺少产品思维框架', severity: 'low' },
];

export function detectRequirementAmbiguity(input: {
  rawIdea?: string;
  problemFraming?: string;
  userScenario?: string;
  mvpScope?: string;
  acceptanceCriteria?: string;
}): AmbiguityIssue[] {
  const issues: AmbiguityIssue[] = [];

  const allText: Array<{ stage: CopilotPhase; text: string }> = [
    { stage: 'rawIdea', text: input.rawIdea || '' },
    { stage: 'problemFraming', text: input.problemFraming || '' },
    { stage: 'userScenario', text: input.userScenario || '' },
    { stage: 'mvpScope', text: input.mvpScope || '' },
    { stage: 'acceptanceCriteria', text: input.acceptanceCriteria || '' },
  ];

  for (const { stage, text } of allText) {
    if (!text) continue;
    for (const { pattern, message, severity } of VAGUE_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        issues.push({
          id: `amb-${issues.length + 1}`,
          stage,
          severity,
          message: `${message}（发现: "${match[0]}"）`,
          question: generateClarifyingQuestion(match[0]),
        });
      }
    }
  }

  // 结构完整性检测
  if (!input.userScenario) {
    issues.push({
      id: `amb-${issues.length + 1}`,
      stage: 'userScenario',
      severity: 'high',
      message: '未定义用户场景',
      question: '目标用户在什么具体场景下遇到什么问题？',
    });
  }
  if (!input.mvpScope) {
    issues.push({
      id: `amb-${issues.length + 1}`,
      stage: 'mvpScope',
      severity: 'high',
      message: '未定义 MVP 范围',
      question: '第一版必须包含哪些功能？明确不能包含哪些功能？',
    });
  }
  if (input.acceptanceCriteria && input.acceptanceCriteria.length < 20) {
    issues.push({
      id: `amb-${issues.length + 1}`,
      stage: 'acceptanceCriteria',
      severity: 'medium',
      message: '验收标准过于简短',
      question: '验收标准是否包含可测试的具体条件？',
    });
  }

  return issues;
}

function generateClarifyingQuestion(matched: string): string {
  const questions: Record<string, string> = {
    '智能化': '你期望的"智能"体现在哪些具体操作上？',
    '自动化': '哪些步骤需要自动化？触发条件是什么？',
    '平台化': '这是否意味着需要多角色登录和后台管理？V1 是否可以先不做？',
    '好用': '请描述一个"好用到超出预期"的具体场景。',
    '简单': '简单到什么程度？能否用步骤数量描述？',
  };
  return questions[matched] || `能否用更具体的语言替换"${matched}"？`;
}
