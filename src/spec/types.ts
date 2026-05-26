export interface StructuredDevSpec {
  projectOverview: {
    productName: string;
    targetUser: string;
    coreScenario: string;
    coreProblem: string;
    productGoal: string;
  };
  mvpScope: {
    mustHave: string[];
    shouldHave: string[];
    outOfScope: string[];
  };
  userFlow: string[];
  pages: Array<{
    name: string;
    purpose: string;
    components: string[];
  }>;
  dataModels: Array<{
    name: string;
    fields: Array<{
      name: string;
      type: string;
      description: string;
    }>;
  }>;
  aiBehaviorRules: string[];
  acceptanceCriteria: string[];
  risks: Array<{
    risk: string;
    reason: string;
    mitigation: string;
  }>;
}
