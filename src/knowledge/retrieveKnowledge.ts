import { KNOWLEDGE_DOCS } from './docs';
import type { KnowledgeDoc, RetrievedKnowledge, RetrievedKnowledgeItem } from './types';

interface RetrieveKnowledgeInput {
  rawIdea: string;
  projectType?: string;
  targetUser?: string;
  scenario?: string;
  problem?: string;
  maxDocs?: number;
}

const DEFAULT_DOC_IDS = [
  'template-product-brief',
  'template-mvp-scope',
  'template-dev-spec',
  'template-codex-prompt',
];
const MIN_RELEVANCE_SCORE = 3;
const STOPWORDS = [
  '一个', '这个', '那个', '想做', '做一', '做个',
  '工具', '系统', '平台', '产品', '功能', '页面',
  '用户', '可以', '需要', '生成', '管理', '记录',
  '提升', '效率', '智能', '分析', '复盘',
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function tokenize(value: string): string[] {
  const normalized = normalize(value);
  const asciiTokens = normalized
    .split(/[^a-z0-9]+/i)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
  const cjkTerms = normalized.match(/[\u4e00-\u9fff]{2,}/g) || [];
  const cjkShortTokens = cjkTerms.flatMap((term) => {
    const tokens: string[] = [];
    for (let size = 2; size <= Math.min(4, term.length); size += 1) {
      for (let index = 0; index <= term.length - size; index += 1) {
        tokens.push(term.slice(index, index + size));
      }
    }
    return tokens;
  });
  return Array.from(new Set([...asciiTokens, ...cjkTerms, ...cjkShortTokens]))
    .filter((token) => token.length >= 2)
    .filter((token) => !STOPWORDS.includes(token))
    .filter((token) => !STOPWORDS.some((word) => token === word || token.length <= 3 && word.includes(token)));
}

function fieldMatches(fieldText: string, queryText: string, tokens: string[]): boolean {
  const text = normalize(fieldText);
  if (!text) return false;
  if (queryText && (queryText.includes(text) || text.includes(queryText))) return true;
  return tokens.some((token) => text.includes(token) || token.includes(text));
}

function matchList(values: string[] | undefined, queryText: string, tokens: string[]): string[] {
  return (values || []).filter((value) => fieldMatches(value, queryText, tokens));
}

function pushField(fields: string[], field: string, matched: boolean): void {
  if (matched && !fields.includes(field)) fields.push(field);
}

function buildReason(item: Omit<RetrievedKnowledgeItem, 'reason'>): string {
  const hits: string[] = [];
  if (item.matchedAliases.length) hits.push(`aliases：${item.matchedAliases.join('、')}`);
  if (item.matchedTags.length) hits.push(`tags：${item.matchedTags.join('、')}`);
  if (item.matchedFields.length) hits.push(`字段：${item.matchedFields.join('、')}`);
  const hitText = hits.length ? `用户输入命中了 ${hits.join('；')}` : '未命中具体关键词';
  return `${hitText}，因此引用 ${item.doc.title} 作为${item.doc.useCases?.[0] || item.doc.type}参考。`;
}

function scoreDoc(doc: KnowledgeDoc, queryText: string, tokens: string[]): RetrievedKnowledgeItem {
  const matchedTags = matchList(doc.tags, queryText, tokens);
  const matchedAliases = matchList(doc.aliases, queryText, tokens);
  const matchedUseCases = matchList(doc.useCases, queryText, tokens);
  const matchedFields: string[] = [];
  const titleMatched = fieldMatches(doc.title, queryText, tokens);
  const summaryMatched = fieldMatches(doc.summary, queryText, tokens);
  const contentMatched = fieldMatches(doc.content, queryText, tokens);

  pushField(matchedFields, 'title', titleMatched);
  pushField(matchedFields, 'summary', summaryMatched);
  pushField(matchedFields, 'content', contentMatched);
  pushField(matchedFields, 'useCases', matchedUseCases.length > 0);

  const score =
    matchedTags.length * 3 +
    matchedAliases.length * 4 +
    matchedUseCases.length * 2 +
    (titleMatched ? 2 : 0) +
    (summaryMatched ? 1 : 0) +
    (contentMatched ? 1 : 0);

  const base = { doc, score, matchedTags, matchedAliases, matchedFields };
  return { ...base, reason: buildReason(base) };
}

function fallbackItems(maxDocs: number): RetrievedKnowledgeItem[] {
  return KNOWLEDGE_DOCS
    .filter((doc) => DEFAULT_DOC_IDS.includes(doc.id))
    .slice(0, maxDocs)
    .map((doc) => ({
      doc,
      score: 0,
      matchedTags: [],
      matchedAliases: [],
      matchedFields: [],
      reason: `未命中具体案例，回退引用 ${doc.title} 作为通用结构模板。`,
    }));
}

export function retrieveKnowledge(input: RetrieveKnowledgeInput): RetrievedKnowledge {
  const maxDocs = input.maxDocs ?? 5;
  const queryText = normalize([
    input.rawIdea,
    input.projectType,
    input.targetUser,
    input.scenario,
    input.problem,
  ].filter(Boolean).join(' '));
  if (!queryText) {
    const items = fallbackItems(maxDocs);
    return {
      items,
      docs: items.map((item) => item.doc),
      usedTags: Array.from(new Set(items.flatMap((item) => item.doc.tags))),
      explanation: `输入为空，已触发 fallback，回退到 ${items.length} 份通用模板文档。`,
    };
  }
  const tokens = tokenize(queryText);

  const ranked = KNOWLEDGE_DOCS
    .map((doc) => scoreDoc(doc, queryText, tokens))
    .filter((item) => item.score >= MIN_RELEVANCE_SCORE)
    .sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title));

  const items = ranked.length ? ranked.slice(0, maxDocs) : fallbackItems(maxDocs);
  const docs = items.map((item) => item.doc);
  const usedTags = Array.from(new Set(docs.flatMap((doc) => doc.tags)));
  const mainHits = Array.from(new Set(items.flatMap((item) => [...item.matchedAliases, ...item.matchedTags]))).slice(0, 8);
  const explanation = ranked.length
    ? `基于关键词匹配命中 ${ranked.length} 份相关知识文档，已选用 ${items.length} 份。最低相关度阈值：${MIN_RELEVANCE_SCORE}。主要命中关键词：${mainHits.length ? mainHits.join('、') : 'title/summary/content'}。`
    : `过滤停用词并应用最低相关度阈值后未命中具体案例，已触发 fallback，回退到 ${items.length} 份通用模板文档。主要命中关键词：暂无。`;

  return { items, docs, usedTags, explanation };
}
