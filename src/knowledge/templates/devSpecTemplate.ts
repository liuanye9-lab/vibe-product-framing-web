function fallback(value: string | undefined): string {
  const text = value?.trim();
  return text || '待补充';
}

function pickLine(source: string, labels: string[]): string {
  const lines = source.split('\n');
  for (const label of labels) {
    const found = lines.find((line) => line.toLowerCase().includes(label.toLowerCase()));
    if (found) return found.replace(/^[-*\s]*/, '').trim();
  }
  return '待补充';
}

export function buildDevSpec(input: {
  productBrief: string;
  mvpScope: string;
  technicalArchitecture: string;
  dataStructure: string;
  acceptanceCriteria: string;
  developmentPrompt: string;
  knowledgeSummary?: string;
}): string {
  const productName = pickLine(input.productBrief, ['产品定义', 'product']);
  const targetUser = pickLine(input.productBrief, ['目标用户', 'target user']);
  const coreScenario = pickLine(input.productBrief, ['使用场景', 'scenario']);
  const coreProblem = pickLine(input.productBrief, ['核心痛点', 'pain', 'problem']);
  const productGoal = pickLine(input.developmentPrompt || input.productBrief, ['产品目标', 'goal']);

  return `# DEV_SPEC

## 1. Project Overview
- Product Name: ${fallback(productName)}
- Target User: ${fallback(targetUser)}
- Core Scenario: ${fallback(coreScenario)}
- Core Problem: ${fallback(coreProblem)}
- Product Goal: ${fallback(productGoal)}

## 2. MVP Scope
${fallback(input.mvpScope)}

### Must Have
${fallback(pickLine(input.mvpScope, ['Must Have', 'must-have', 'P0']))}

### Should Have
${fallback(pickLine(input.mvpScope, ['Should Have', 'should-have', 'P1']))}

### Out of Scope
${fallback(pickLine(input.mvpScope, ['Out of Scope', 'out-of-scope', '不做']))}

## 3. User Flow
${fallback(pickLine(input.developmentPrompt, ['用户主流程', 'user flow']))}

## 4. Page Structure
${fallback(pickLine(input.developmentPrompt, ['页面结构', 'page structure']))}

## 5. Data Model
${fallback(input.dataStructure)}

## 6. Core Functions
- 采集并保存用户的产品想法、目标用户、场景和问题。
- 基于阶段性决策生成 Product Brief、MVP Scope、Technical Architecture 和 Acceptance Criteria。
- 生成可复制、可下载的开发交付包。
- 在 AI 不可用时使用本地规则生成可用的 V1 handoff。

## 7. AI Behavior Rules
- AI 输出必须基于用户输入和 Knowledge References，不要自由扩写成完整平台。
- V1 默认不加入登录、支付、团队协作、数据库，除非用户明确要求。
- AI API 不可用时必须明确提示，不允许 mock 冒充真实 AI 分析。
- 所有生成内容必须保留 V1 范围、Out of Scope 和可测试验收标准。

## 8. Acceptance Criteria
${fallback(input.acceptanceCriteria)}

## 9. Risks
- 需求、范围或技术信息缺失时，生成内容可能仍需人工复核。
- 如果 MVP Scope 没有明确 Out of Scope，开发工具可能过度实现。
- 如果验收标准不可测试，开发完成判断会变得主观。

## 10. Codex Implementation Notes
${fallback(input.developmentPrompt)}

${input.knowledgeSummary ? `## Knowledge Notes\n${input.knowledgeSummary}` : ''}`;
}
