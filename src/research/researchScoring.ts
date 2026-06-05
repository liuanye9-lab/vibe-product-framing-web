/**
 * Research Scoring — V6.0
 *
 * Lightweight relevance scoring for research results.
 * Used to rank and filter results before presenting to the user.
 */

// ─── GitHub Scoring ───────────────────────────────────────────────────────────

export function scoreGitHubRepo(
  repo: {
    stars?: number;
    updatedAt?: string;
    description?: string;
  },
  keywords: string[],
): number {
  let score = 0;

  // Stars signal (log scale, max 30)
  if (repo.stars) {
    if (repo.stars >= 10000) score += 30;
    else if (repo.stars >= 1000) score += 25;
    else if (repo.stars >= 100) score += 20;
    else if (repo.stars >= 10) score += 15;
    else score += 5;
  }

  // Recency signal (max 30)
  if (repo.updatedAt) {
    const daysSinceUpdate = (Date.now() - new Date(repo.updatedAt).getTime()) / 86400000;
    if (daysSinceUpdate < 30) score += 30;
    else if (daysSinceUpdate < 90) score += 25;
    else if (daysSinceUpdate < 365) score += 15;
    else score += 5;
  }

  // Keyword relevance in description (max 40)
  if (repo.description && keywords.length > 0) {
    const desc = repo.description.toLowerCase();
    const matched = keywords.filter((kw) => desc.includes(kw.toLowerCase()));
    score += Math.min(40, (matched.length / keywords.length) * 40);
  }

  return Math.min(100, Math.round(score));
}

// ─── Paper Scoring ────────────────────────────────────────────────────────────

export function scorePaper(
  paper: {
    year?: number;
    abstract?: string;
    title?: string;
  },
  keywords: string[],
): number {
  let score = 0;

  // Recency (max 40)
  if (paper.year) {
    const currentYear = new Date().getFullYear();
    const age = currentYear - paper.year;
    if (age <= 1) score += 40;
    else if (age <= 3) score += 30;
    else if (age <= 5) score += 20;
    else score += 10;
  }

  // Keyword relevance in title + abstract (max 60)
  const text = `${paper.title ?? ''} ${paper.abstract ?? ''}`.toLowerCase();
  if (keywords.length > 0) {
    const matched = keywords.filter((kw) => text.includes(kw.toLowerCase()));
    score += Math.min(60, (matched.length / keywords.length) * 60);
  }

  return Math.min(100, Math.round(score));
}

// ─── Competitor Scoring ───────────────────────────────────────────────────────

export function scoreCompetitor(
  competitor: {
    description?: string;
    title?: string;
    snippet?: string;
  },
  keywords: string[],
): number {
  let score = 0;

  const text = `${competitor.title ?? ''} ${competitor.description ?? ''} ${competitor.snippet ?? ''}`.toLowerCase();

  if (keywords.length > 0) {
    const matched = keywords.filter((kw) => text.includes(kw.toLowerCase()));
    score += Math.min(70, (matched.length / keywords.length) * 70);
  }

  // Has URL = more credible
  if (competitor.description || competitor.snippet) {
    score += 30;
  }

  return Math.min(100, Math.round(score));
}

// ─── Sort helpers ─────────────────────────────────────────────────────────────

export function sortByRelevance<T extends { relevanceScore: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.relevanceScore - a.relevanceScore);
}

export function deduplicateByField<T>(items: T[], field: keyof T): T[] {
  const seen = new Set<unknown>();
  return items.filter((item) => {
    const val = item[field];
    if (seen.has(val)) return false;
    seen.add(val);
    return true;
  });
}
