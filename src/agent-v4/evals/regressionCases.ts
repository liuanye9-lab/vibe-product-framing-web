/**
 * Regression Cases — test cases for validating agent workflow.
 *
 * These are local-only checks that verify the agent workflow
 * produces correct outcomes for known input patterns.
 * V1 uses local rules, no AI calls.
 */

import type { RegressionCase } from './evalTypes';

export const REGRESSION_CASES: RegressionCase[] = [
  {
    id: 'case-ielts-vocab',
    title: '雅思生词错题工具',
    input: {
      rawIdea: '雅思生词和错题管理工具',
      targetUser: '准备雅思考试的英语学习者',
      scenario: '刷题后需要整理生词和错题进行复习',
      projectType: 'Web App',
    },
    expectations: {
      demandUserIdentified: true,
      mvpCoreLoop: true,
      outOfScopeContainsAuth: true,
      outOfScopeContainsPayment: true,
      techHasMockStrategy: true,
      reviewerChecksQuality: true,
    },
  },
  {
    id: 'case-prompteval-lab',
    title: 'PromptEval Lab',
    input: {
      rawIdea: 'Prompt 评测实验平台',
      targetUser: 'AI 产品开发者和提示工程师',
      scenario: '需要系统化评测、对比和记录不同 prompt 效果',
      projectType: 'Web App',
    },
    expectations: {
      demandUserIdentified: true,
      mvpCoreLoop: true,
      outOfScopeContainsAuth: true,
      outOfScopeContainsPayment: true,
      techHasMockStrategy: true,
      reviewerChecksQuality: true,
    },
  },
  {
    id: 'case-ai-customer-service',
    title: 'AI 客服质检系统',
    input: {
      rawIdea: 'AI 客服回复质量自动质检系统',
      targetUser: '客服团队管理者',
      scenario: '每天需要抽检大量客服回复，确保质量',
      projectType: 'Web App',
    },
    expectations: {
      demandUserIdentified: true,
      mvpCoreLoop: true,
      outOfScopeContainsAuth: true,
      outOfScopeContainsPayment: true,
      techHasMockStrategy: true,
      reviewerChecksQuality: true,
    },
  },
  {
    id: 'case-stock-review',
    title: '股票投资复盘工具',
    input: {
      rawIdea: '个人股票交易记录和复盘分析工具',
      targetUser: '个人投资者',
      scenario: '交易后需要系统化记录和复盘',
      projectType: 'Web App',
    },
    expectations: {
      demandUserIdentified: true,
      mvpCoreLoop: true,
      outOfScopeContainsAuth: true,
      outOfScopeContainsPayment: true,
      techHasMockStrategy: true,
      reviewerChecksQuality: true,
      riskWarnsNotFinancialAdvice: true,
      avoidCrossCaseMatch: ['雅思', 'IELTS'],
    },
  },
];
