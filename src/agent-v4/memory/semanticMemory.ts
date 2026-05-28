/**
 * Semantic Memory — knowledge doc references.
 *
 * Reads from existing src/knowledge docs. V1 uses tag/alias matching
 * (no embeddings). Returns relevant docs and their summaries.
 */

import { retrieveKnowledge } from '../../knowledge/retrieveKnowledge';

interface SemanticReference {
  id: string;
  title: string;
  type: string;
  summary: string;
  tags: string[];
  aliases: string[];
  score: number;
}

export function searchSemanticMemory(query: {
  rawIdea?: string;
  projectType?: string;
  targetUser?: string;
  scenario?: string;
  problem?: string;
}): SemanticReference[] {
  try {
    const result = retrieveKnowledge({
      rawIdea: query.rawIdea || '',
      projectType: query.projectType,
      targetUser: query.targetUser,
      scenario: query.scenario,
      problem: query.problem,
      maxDocs: 5,
    });

    const items = result.items?.length ? result.items : result.docs.map((doc) => ({
      doc,
      score: 0,
      matchedTags: [],
      matchedAliases: [],
      matchedFields: [],
      reason: `Referenced: ${doc.title}`,
    }));

    return items.map((item) => ({
      id: item.doc.id,
      title: item.doc.title,
      type: item.doc.type,
      summary: item.doc.summary,
      tags: item.matchedTags || [],
      aliases: item.matchedAliases || [],
      score: item.score || 0,
    }));
  } catch {
    return [];
  }
}
