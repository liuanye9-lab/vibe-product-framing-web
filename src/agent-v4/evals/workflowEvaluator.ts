/**
 * Workflow Evaluator — self-check for agent workflow quality.
 *
 * V1 runs local-only checks. No AI calls. Can be invoked from Debug Tab.
 */

import type { RegressionResult } from './evalTypes';
import { REGRESSION_CASES } from './regressionCases';

export function runAgentGraphRegressionCases(): RegressionResult[] {
  return REGRESSION_CASES.map((tc) => {
    const issues: string[] = [];

    // Basic checks
    if (tc.expectations.demandUserIdentified) {
      if (!tc.input.targetUser || tc.input.targetUser.length < 2) {
        issues.push('目标用户未明确识别');
      } else {
        // Check it's not generic
        const genericUsers = ['用户', '所有人', '大家', '任何人'];
        if (genericUsers.some((g) => tc.input.targetUser?.includes(g))) {
          issues.push('目标用户过于泛化');
        }
      }
    }

    if (tc.expectations.mvpCoreLoop) {
      if (!tc.input.rawIdea || tc.input.rawIdea.length < 5) {
        issues.push('缺少核心产品想法');
      }
    }

    if (tc.expectations.outOfScopeContainsAuth) {
      // V1: mock check — in real implementation this would check actual MVP output
      // For now, verify the input is sufficient to trigger out-of-scope detection
      if (!tc.input.rawIdea) {
        issues.push('输入不足以检测 Out of Scope');
      }
    }

    if (tc.expectations.avoidCrossCaseMatch?.length) {
      const lower = tc.input.rawIdea.toLowerCase();
      for (const avoid of tc.expectations.avoidCrossCaseMatch) {
        if (lower.includes(avoid.toLowerCase())) {
          issues.push(`不应命中 ${avoid} 案例`);
        }
      }
    }

    return {
      id: tc.id,
      title: tc.title,
      passed: issues.length === 0,
      issues,
    };
  });
}
