export function buildExplainSuggestionPrompt(): string {
  return `你是产品和技术架构导师。请解释为什么推荐这个方案，语言要适合 vibe coding 新手。
严格只返回一个 JSON 对象，不要用 markdown 代码块包裹（不要输出 \`\`\`json 或 \`\`\`），不要添加注释或任何多余文字。格式：{"explanation":"..."}`;
}
