/**
 * Episodic Memory — key events during a session.
 *
 * Tracks: what user changed, rejected findings, repeated questions,
 * accepted/rejected agent judgments. Capped at 100 items.
 */

import type { AgentMemoryItem } from './memoryTypes';

const MEMORY_KEY = 'vibepilot_agent_memory_v4';
const MAX_ITEMS = 100;

function loadAll(): AgentMemoryItem[] {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(items: AgentMemoryItem[]): void {
  try {
    const capped = items.slice(-MAX_ITEMS);
    localStorage.setItem(MEMORY_KEY, JSON.stringify(capped));
  } catch {
    console.warn('[AgentV4 Memory] Failed to save');
  }
}

export function addMemoryItem(input: Omit<AgentMemoryItem, 'id' | 'createdAt'>): AgentMemoryItem {
  const item: AgentMemoryItem = {
    ...input,
    id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  const all = loadAll();
  all.push(item);
  saveAll(all);
  return item;
}

export function getMemoryItems(type?: string, limit = 20): AgentMemoryItem[] {
  const all = loadAll();
  const filtered = type ? all.filter((m) => m.type === type) : all;
  return filtered.slice(-limit).reverse();
}

export function getRecentReflections(limit = 5): AgentMemoryItem[] {
  return getMemoryItems('reflection', limit);
}

export function clearAllMemory(): void {
  try {
    localStorage.removeItem(MEMORY_KEY);
  } catch {
    // ignore
  }
}
