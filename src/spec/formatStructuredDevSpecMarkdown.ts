import type { StructuredDevSpec } from './types';

function bullet(items: string[]): string {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : '- 待补充';
}

export function formatStructuredDevSpecMarkdown(spec: StructuredDevSpec): string {
  return `# DEV_SPEC

## 1. Project Overview
- Product Name: ${spec.projectOverview.productName}
- Target User: ${spec.projectOverview.targetUser}
- Core Scenario: ${spec.projectOverview.coreScenario}
- Core Problem: ${spec.projectOverview.coreProblem}
- Product Goal: ${spec.projectOverview.productGoal}

## 2. MVP Scope
### Must Have
${bullet(spec.mvpScope.mustHave)}

### Should Have
${bullet(spec.mvpScope.shouldHave)}

### Out of Scope
${bullet(spec.mvpScope.outOfScope)}

## 3. User Flow
${bullet(spec.userFlow)}

## 4. Page Structure
${spec.pages.map((page) => `### ${page.name}\n- Purpose: ${page.purpose}\n- Components: ${page.components.join(', ')}`).join('\n\n')}

## 5. Data Model
${spec.dataModels.map((model) => `### ${model.name}\n${model.fields.map((field) => `- ${field.name}: ${field.type} — ${field.description}`).join('\n')}`).join('\n\n')}

## 6. AI Behavior Rules
${bullet(spec.aiBehaviorRules)}

## 7. Acceptance Criteria
${bullet(spec.acceptanceCriteria)}

## 8. Risks
${spec.risks.map((risk) => `- ${risk.risk}: ${risk.reason} Mitigation: ${risk.mitigation}`).join('\n')}`;
}
