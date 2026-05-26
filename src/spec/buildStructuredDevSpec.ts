import type { KnowledgeReference, ProductBrief } from '../types';
import type { StructuredDevSpec } from './types';

function text(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join('；');
  if (typeof value === 'object' && 'value' in value) return text((value as { value?: unknown }).value);
  return '';
}

function list(value: unknown): string[] {
  const raw = text(value);
  return raw
    .split(/\n|；|;|、/)
    .map((item) => item.replace(/^[-*\d.)）\s]+/, '').trim())
    .filter(Boolean);
}

function nonEmptyList(value: unknown, fallback: string[]): string[] {
  const items = list(value);
  return items.length ? items : fallback;
}

function line(source: string, labels: string[]): string {
  return source.split('\n').find((item) => labels.some((label) => item.toLowerCase().includes(label.toLowerCase())))?.replace(/^[-*\s]*/, '').trim() || '';
}

function extractSection(source: string, headings: string[]): string {
  const lines = source.split('\n');
  const start = lines.findIndex((item) => headings.some((heading) => item.toLowerCase().includes(heading.toLowerCase())));
  if (start < 0) return '';
  const collected: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const lineText = lines[index].trim();
    if (collected.length && /^#{1,3}\s+/.test(lineText)) break;
    if (collected.length && /^[A-Z][A-Za-z\s]+:$/.test(lineText)) break;
    if (lineText) collected.push(lineText);
    else if (collected.length) break;
  }
  return collected.join('\n');
}

function hasDoc(refs: KnowledgeReference[] | undefined, id: string): boolean {
  return Boolean(refs?.some((ref) => ref.id === id));
}

function dataModels(refs: KnowledgeReference[] | undefined): StructuredDevSpec['dataModels'] {
  if (hasDoc(refs, 'case-ielts-reading-webapp')) {
    return [
      { name: 'VocabularyItem', fields: [
        { name: 'id', type: 'string', description: '生词 ID' },
        { name: 'word', type: 'string', description: '单词或短语' },
        { name: 'meaning', type: 'string', description: '中文释义' },
        { name: 'sourceQuestionId', type: 'string?', description: '来源题目' },
        { name: 'reviewCount', type: 'number', description: '复习次数' },
      ] },
      { name: 'WrongAnswerRecord', fields: [
        { name: 'id', type: 'string', description: '错题记录 ID' },
        { name: 'question', type: 'string', description: '题目文本' },
        { name: 'wrongAnswer', type: 'string', description: '用户错误答案' },
        { name: 'correctAnswer', type: 'string', description: '正确答案' },
        { name: 'reason', type: 'string', description: '错误原因' },
      ] },
      { name: 'ReviewSession', fields: [
        { name: 'id', type: 'string', description: '复盘会话 ID' },
        { name: 'itemIds', type: 'string[]', description: '复盘词汇或错题 ID' },
        { name: 'createdAt', type: 'string', description: '创建时间' },
      ] },
    ];
  }
  if (hasDoc(refs, 'case-prompteval-lab')) {
    return [
      { name: 'PromptVersion', fields: [
        { name: 'id', type: 'string', description: '提示词版本 ID' },
        { name: 'content', type: 'string', description: '提示词内容' },
        { name: 'versionName', type: 'string', description: '版本名称' },
      ] },
      { name: 'EvaluationRun', fields: [
        { name: 'id', type: 'string', description: '评测记录 ID' },
        { name: 'promptVersionId', type: 'string', description: '关联提示词版本' },
        { name: 'outputUrl', type: 'string?', description: '生图或输出链接' },
        { name: 'scores', type: 'ScoreDimension[]', description: '评分维度' },
      ] },
      { name: 'ScoreDimension', fields: [
        { name: 'name', type: 'string', description: '维度名称' },
        { name: 'score', type: 'number', description: '评分' },
        { name: 'reason', type: 'string', description: '评分理由' },
      ] },
    ];
  }
  if (hasDoc(refs, 'case-ai-customer-service-evaluation')) {
    return [
      { name: 'ConversationCase', fields: [
        { name: 'id', type: 'string', description: '会话案例 ID' },
        { name: 'messages', type: 'string[]', description: '客服上下文' },
        { name: 'aiResponse', type: 'string', description: '待评估回复' },
      ] },
      { name: 'ResponseEvaluation', fields: [
        { name: 'id', type: 'string', description: '评估 ID' },
        { name: 'scores', type: 'Record<string, number>', description: '评分维度' },
        { name: 'evidence', type: 'string[]', description: '证据摘录' },
      ] },
      { name: 'RewriteSuggestion', fields: [
        { name: 'id', type: 'string', description: '改写建议 ID' },
        { name: 'text', type: 'string', description: '建议回复' },
        { name: 'reason', type: 'string', description: '改写理由' },
      ] },
    ];
  }
  return [
    { name: 'ProjectIdea', fields: [
      { name: 'id', type: 'string', description: '项目 ID' },
      { name: 'rawIdea', type: 'string', description: '原始想法' },
      { name: 'targetUser', type: 'string?', description: '目标用户' },
      { name: 'scenario', type: 'string?', description: '使用场景' },
    ] },
    { name: 'AiSuggestion', fields: [
      { name: 'value', type: 'string | string[] | number | boolean', description: '建议值' },
      { name: 'reason', type: 'string', description: '推荐理由' },
      { name: 'risks', type: 'string[]', description: '风险' },
    ] },
    { name: 'FinalHandoff', fields: [
      { name: 'productBrief', type: 'string', description: '产品说明' },
      { name: 'mvpScope', type: 'string', description: 'MVP 范围' },
      { name: 'devSpec', type: 'string', description: '开发规格' },
      { name: 'evaluation', type: 'HandoffEvaluation?', description: '质量评估' },
    ] },
  ];
}

export function buildStructuredDevSpec(input: {
  brief: ProductBrief;
  productBrief: string;
  mvpScope: string;
  technicalArchitecture: string;
  dataStructure: string;
  acceptanceCriteria: string;
  developmentPrompt: string;
  knowledgeReferences?: KnowledgeReference[];
}): StructuredDevSpec {
  const product = input.brief.stages.product;
  const mvp = input.brief.stages.mvp;
  const idea = input.brief.ideaInput;
  const productGoal = extractSection(input.developmentPrompt, ['产品目标', 'Product Goal']) || line(input.developmentPrompt, ['产品目标', 'Product Goal']) || idea.rawIdea || '待补充';
  return {
    projectOverview: {
      productName: text(product.productOneLiner) || line(input.productBrief, ['产品定义', 'Product Name']) || idea.rawIdea || '待补充',
      targetUser: text(product.targetUser) || idea.targetUser || line(input.productBrief, ['目标用户', 'Target User']) || '待补充',
      coreScenario: text(product.scenario) || idea.scenario || line(input.productBrief, ['使用场景', 'Core Scenario']) || '待补充',
      coreProblem: text(product.corePainPoint) || idea.problem || line(input.productBrief, ['核心痛点', 'Core Problem']) || '待补充',
      productGoal,
    },
    mvpScope: {
      mustHave: nonEmptyList(mvp.mustHave, nonEmptyList(extractSection(input.mvpScope, ['Must Have']), ['待补充 Must Have'])),
      shouldHave: nonEmptyList(mvp.shouldHave, nonEmptyList(extractSection(input.mvpScope, ['Should Have']), ['待补充 Should Have'])),
      outOfScope: nonEmptyList(mvp.outOfScope, nonEmptyList(extractSection(input.mvpScope, ['Out of Scope']), ['登录', '支付', '团队协作', '数据库', 'MCP Server'])),
    },
    userFlow: [
      '用户输入产品想法和必要上下文。',
      '系统检索本地知识库并生成解释化引用。',
      '系统生成 Product Brief、MVP Scope、DEV_SPEC 和 Development Prompt。',
      '系统评估 handoff 质量并给出本地修复建议。',
    ],
    pages: [
      { name: 'Idea Diagnosis', purpose: '收集并诊断产品想法', components: ['Idea input', 'Mode selector', 'Decision card'] },
      { name: 'MVP Decision', purpose: '收敛第一版范围', components: ['Must Have list', 'Out of Scope list', 'Scope warning'] },
      { name: 'Tech Decision', purpose: '选择最低成本技术方案', components: ['Architecture summary', 'Data flow', 'Mock strategy'] },
      { name: 'Developer Handoff', purpose: '输出开发交付包和质量闭环', components: ['Knowledge References', 'DEV_SPEC', 'Evaluation Report', 'Generation Trace'] },
    ],
    dataModels: dataModels(input.knowledgeReferences),
    aiBehaviorRules: [
      'AI 输出必须基于用户输入和 Knowledge References。',
      'AI API 不可用时不能用 mock 冒充真实 AI 分析。',
      '默认不新增数据库、认证、支付、团队协作、向量数据库、Embedding、Rerank 或 MCP Server。',
      '复杂对象渲染前必须格式化为字符串、列表或专门组件。',
    ],
    acceptanceCriteria: nonEmptyList(input.acceptanceCriteria, nonEmptyList(extractSection(input.developmentPrompt, ['验收标准', 'Acceptance Criteria']), ['用户可以生成、复制、下载完整 Developer Handoff。'])),
    risks: [
      { risk: '范围膨胀', reason: 'V1 容易加入登录、团队或数据库。', mitigation: '保持 Out of Scope 明确并在 Development Prompt 中重复限制。' },
      { risk: '检索误命中', reason: '轻量关键词检索没有语义理解。', mitigation: '使用 stopwords、最低分数和引用 reason 辅助人工判断。' },
      { risk: '验收不可测试', reason: '自然语言标准可能过于主观。', mitigation: '使用 Evaluation fixSuggestions 补充可测试动作和完成判断。' },
    ],
  };
}
