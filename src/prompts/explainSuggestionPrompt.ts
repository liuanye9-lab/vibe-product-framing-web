export function buildExplainSuggestionPrompt(): string {
  return '你是产品和技术架构导师。请解释为什么推荐这个方案，语言要适合 vibe coding 新手。只返回 JSON：{"explanation":"..."}';
}
