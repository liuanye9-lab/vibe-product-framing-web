import type { ScopeControlResult } from '../types';

const SCOPE_CREEP_TERMS = ['登录', '注册', '支付', '微信支付', '支付宝', '后台管理', '管理员', '权限', '团队协作', '多租户', '数据库', '向量数据库', 'MCP Server', '微服务'];

export function deriveScopeControl(input: {
  rawIdea: string;
  featuresText?: string;
  projectType?: string;
}): ScopeControlResult {
  const featuresText = input.featuresText || input.rawIdea || '';
  const suggestions: string[] = [];

  // 从 rawIdea 推导 P0
  const p0 = extractP0Features(featuresText);
  const p1 = extractP1Features();
  const p2: string[] = [];
  const outOfScope = extractOutOfScope(featuresText);
  const scopeRisks: string[] = [];

  if (p0.length > 5) {
    scopeRisks.push(`P0 功能数量 (${p0.length}) 超过建议值 (≤5)，建议进一步收敛`);
    suggestions.push('关注最小闭环：用户完成一次核心操作的完整路径');
  }
  if (p0.length === 0) {
    scopeRisks.push('未能从输入中提取到明确的 P0 功能');
    suggestions.push('请明确描述第一版的最小功能集');
  }
  if (outOfScope.length === 0) {
    scopeRisks.push('未定义 Out of Scope，存在范围膨胀风险');
    suggestions.push('明确列出 V1 不做什么，防止 scope creep');
  }

  for (const term of SCOPE_CREEP_TERMS) {
    if (featuresText.includes(term) && !outOfScope.includes(term)) {
      scopeRisks.push(`检测到可能的范围膨胀词: "${term}"，建议确认是否 V1 需要`);
    }
  }

  return { p0, p1, p2, outOfScope, scopeRisks, suggestions };
}

function extractP0Features(text: string): string[] {
  const features: string[] = [];
  const lines = text.split(/[\n,，;；]/);
  for (const line of lines) {
    const trimmed = line.trim().replace(/^[-*\d.)）\s]+/, '');
    if (trimmed.length > 3 && trimmed.length < 60) {
      features.push(trimmed);
    }
  }
  return features.slice(0, 5);
}

function extractP1Features(): string[] {
  return [];
}

function extractOutOfScope(text: string): string[] {
  const outOfScope: string[] = [];
  for (const term of SCOPE_CREEP_TERMS) {
    if (!text.includes(term)) {
      outOfScope.push(term);
    }
  }
  return outOfScope;
}
