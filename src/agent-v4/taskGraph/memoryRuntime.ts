/**
 * V5.2 Memory Runtime — TaskGraph-specific memory for decisions, bad cases, and reflections
 *
 * Complements the existing 5-layer memory system (agent-v4/memory/).
 * This module focuses on decision workflow memory that persists across sessions.
 */

const MEMORY_STORAGE_KEY = 'vibepilot_agent_taskgraph_memory_v1';
const MAX_MEMORIES = 100;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AgentMemoryEntry {
  id: string;
  briefId?: string;
  type: 'decision' | 'bad_case' | 'reflection' | 'preference' | 'skill_usage';
  title: string;
  content: string;
  tags: string[];
  sourceTaskId?: string;
  createdAt: string;
}

// ─── ID Generation ──────────────────────────────────────────────────────────

function generateMemoryId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `mem-${ts}-${rand}`;
}

// ─── Storage ────────────────────────────────────────────────────────────────

function loadMemories(): AgentMemoryEntry[] {
  try {
    const raw = localStorage.getItem(MEMORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as AgentMemoryEntry[]).filter(
      m => m && typeof m.id === 'string' && typeof m.title === 'string',
    );
  } catch {
    return [];
  }
}

function saveMemories(memories: AgentMemoryEntry[]): void {
  try {
    const capped = memories.slice(-MAX_MEMORIES);
    localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(capped));
  } catch {
    // Storage full — silently fail
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function addMemory(entry: Omit<AgentMemoryEntry, 'id' | 'createdAt'>): AgentMemoryEntry {
  const memories = loadMemories();
  const full: AgentMemoryEntry = {
    ...entry,
    id: generateMemoryId(),
    createdAt: new Date().toISOString(),
  };
  memories.push(full);
  saveMemories(memories);
  return full;
}

export function listMemories(input?: {
  briefId?: string;
  tags?: string[];
  limit?: number;
}): AgentMemoryEntry[] {
  let memories = loadMemories();

  if (input?.briefId) {
    memories = memories.filter(m => m.briefId === input.briefId);
  }

  if (input?.tags && input.tags.length > 0) {
    memories = memories.filter(m =>
      input.tags!.some(tag => m.tags.includes(tag)),
    );
  }

  memories.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (input?.limit) {
    memories = memories.slice(0, input.limit);
  }

  return memories;
}

export function findRelevantMemories(input: {
  briefId: string;
  userMessage: string;
  currentTaskTitle: string;
}): AgentMemoryEntry[] {
  const memories = loadMemories();
  const query = `${input.userMessage} ${input.currentTaskTitle}`.toLowerCase();

  // Get memories for this brief + global memories (no briefId)
  const candidateMemories = memories.filter(
    m => m.briefId === input.briefId || !m.briefId,
  );

  // Score by relevance
  const scored = candidateMemories
    .map(memory => {
      let score = 0;

      // Title match
      if (query.includes(memory.title.toLowerCase())) {
        score += 3;
      }

      // Tag match
      for (const tag of memory.tags) {
        if (query.includes(tag.toLowerCase())) {
          score += 2;
        }
      }

      // Content match (partial)
      const contentWords = memory.content.toLowerCase().split(/[，,、\s]+/);
      for (const word of contentWords) {
        if (word.length > 2 && query.includes(word)) {
          score += 1;
        }
      }

      // Recency bonus (newer memories get slight boost)
      const ageMs = Date.now() - new Date(memory.createdAt).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      if (ageDays < 1) score += 2;
      else if (ageDays < 7) score += 1;

      return { memory, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return scored.map(item => item.memory);
}

export function getMemory(id: string): AgentMemoryEntry | undefined {
  return loadMemories().find(m => m.id === id);
}

export function deleteMemory(id: string): void {
  const memories = loadMemories().filter(m => m.id !== id);
  saveMemories(memories);
}

export function clearMemories(): void {
  saveMemories([]);
}
