import type { FramingStage, ProductBrief } from '../types';
import { QUALITY_GATES, TECH_COMPLEXITY_RULES } from '../skill/qualityGates';
import { PRODUCT_FRAMING_RULES, RECOMMENDED_PATH_REQUIREMENTS } from '../skill/systemRules';
import { MOCK_STRATEGY_EXAMPLE, TECH_TRANSLATION_EXAMPLE } from '../skill/examples';

export function buildBriefContext(brief: ProductBrief): string {
  return JSON.stringify({
    mode: brief.mode,
    ideaInput: brief.ideaInput,
    acceptedDecisions: {
      discovery: brief.stages.discovery,
      product: brief.stages.product,
      business: brief.stages.business,
      technical: brief.stages.technical,
      mvp: brief.stages.mvp,
      blindSpot: brief.stages.blindSpot,
    },
  }, (_key, value) => {
    if (typeof value === 'string' && value.length > 900) return `${value.slice(0, 900)}...`;
    if (Array.isArray(value) && value.length > 8) return value.slice(0, 8);
    return value;
  }, 2);
}

export function buildSuggestStagePrompt(stage: FramingStage): string {
  return `你是 AI 辅助的 Vibe Coding 产品前期构思 Copilot。请基于用户输入生成 ${stage} 阶段建议。

产品规则：
${PRODUCT_FRAMING_RULES.map((rule) => `- ${rule}`).join('\n')}

质量门：
${QUALITY_GATES.map((rule) => `- ${rule}`).join('\n')}

技术不过度工程化规则：
${TECH_COMPLEXITY_RULES.map((rule) => `- ${rule}`).join('\n')}

推荐路径要求：
每次建议都要优先体现：${RECOMMENDED_PATH_REQUIREMENTS.join('、')}。详细内容放到 details 或 reason/risk/alternatives 中，不要让用户一次判断所有信息。

输出要求：
1. 只返回 JSON，不要 Markdown。
2. 只生成当前 ${stage} 阶段需要的字段，不要重复输出其他阶段。
3. 每个字段格式必须是 {"value": string 或 string[], "reason": string, "risks": string[], "alternatives": string[]}。
4. 单个 value 控制在 80 字以内，reason 控制在 45 字以内；risks 和 alternatives 各不超过 2 条。
5. 技术规划必须包含推荐方案、推荐理由、风险、替代方案，避免过度工程化。
6. MVP 阶段如果发现范围膨胀，必须给出 scopeCreepWarning。
7. 技术翻译示例：${JSON.stringify(TECH_TRANSLATION_EXAMPLE)}。
8. Mock 策略示例：${JSON.stringify(MOCK_STRATEGY_EXAMPLE)}。
9. 输出必须明确引用用户输入中的至少两个字段：rawIdea、targetUser、scenario、problem、projectType。不要生成与当前产品想法无关的通用模板。
10. AI/API 不可用时不要编造本地 mock 结果；应由产品停止生成并提示用户修复配置。`;
}
