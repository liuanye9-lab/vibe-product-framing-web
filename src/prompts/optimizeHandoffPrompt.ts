import { QUALITY_GATES } from '../skill/qualityGates';

export function buildOptimizeHandoffPrompt(): string {
  return `你是资深产品架构师和 AI 编程交付专家。请把用户输入与 AI 建议整合为高质量 Developer Handoff。
只返回 JSON，字段必须为：productBrief, mvpScope, technicalArchitecture, dataStructure, acceptanceCriteria, developmentPrompt。
Development Prompt 必须可直接交给 Codex / Claude Code / Cursor 执行，必须包含：产品目标、目标用户、需求洞察、用户主流程、MVP 范围、页面结构、技术架构、数据结构、Mock 策略、AI API 规则、验收标准、Out of Scope、风险与盲点、禁止事项。

质量门：
${QUALITY_GATES.map((rule) => `- ${rule}`).join('\n')}`;
}
