export function buildKnowledgeEnhancedCodexPrompt(input: {
  devSpec: string;
  constraints?: string[];
  testCommand?: string;
}): string {
  const constraints = input.constraints?.length
    ? input.constraints.map((item) => `- ${item}`).join('\n')
    : [
      '- Keep the existing project flow intact.',
      '- Do not add database, vector database, embeddings, rerank, or MCP server.',
      '- Run the build command and fix TypeScript errors.',
    ].join('\n');

  return `# Codex Development Prompt

Implement the following DEV_SPEC in the existing codebase.

${input.devSpec}

## Constraints
${constraints}

## Verification
- Run ${input.testCommand || 'npm run build'}.
- Report changed files and any remaining gaps.`;
}
