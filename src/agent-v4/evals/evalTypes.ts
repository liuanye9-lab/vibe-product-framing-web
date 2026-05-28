/**
 * Eval Types — evaluation type definitions for workflow and regression tests.
 */

export interface RegressionCase {
  id: string;
  title: string;
  input: {
    rawIdea: string;
    targetUser?: string;
    scenario?: string;
    projectType?: string;
  };
  expectations: {
    demandUserIdentified: boolean;
    mvpCoreLoop: boolean;
    outOfScopeContainsAuth: boolean;
    outOfScopeContainsPayment: boolean;
    techHasMockStrategy: boolean;
    reviewerChecksQuality: boolean;
    riskWarnsNotFinancialAdvice?: boolean;
    avoidCrossCaseMatch?: string[];
  };
}

export interface RegressionResult {
  id: string;
  title: string;
  passed: boolean;
  issues: string[];
}
