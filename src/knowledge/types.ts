export type KnowledgeDocType =
  | 'case'
  | 'prd-template'
  | 'architecture-template'
  | 'prompt-sample'
  | 'rubric';

export interface KnowledgeDoc {
  id: string;
  title: string;
  type: KnowledgeDocType;
  tags: string[];
  aliases?: string[];
  useCases?: string[];
  summary: string;
  content: string;
}

export interface RetrievedKnowledgeItem {
  doc: KnowledgeDoc;
  score: number;
  matchedTags: string[];
  matchedAliases: string[];
  matchedFields: string[];
  reason: string;
}

export interface RetrievedKnowledge {
  items: RetrievedKnowledgeItem[];
  docs: KnowledgeDoc[];
  usedTags: string[];
  explanation: string;
}
