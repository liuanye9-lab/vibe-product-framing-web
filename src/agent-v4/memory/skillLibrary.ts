/**
 * Skill Library — reusable process templates.
 *
 * Skills are created by the reflection node when certain patterns repeat.
 * Each skill captures: trigger conditions, recommended steps, and output templates.
 * Stored in localStorage, max 50 items.
 */

import type { AgentSkill } from './memoryTypes';

const SKILL_KEY = 'vibepilot_agent_skills_v4';
const MAX_SKILLS = 50;

function loadAll(): AgentSkill[] {
  try {
    const raw = localStorage.getItem(SKILL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(skills: AgentSkill[]): void {
  try {
    const capped = skills.slice(-MAX_SKILLS);
    localStorage.setItem(SKILL_KEY, JSON.stringify(capped));
  } catch {
    console.warn('[AgentV4 Skills] Failed to save');
  }
}

export function addSkill(input: {
  title: string;
  triggerTags: string[];
  applicableWhen: string;
  recommendedSteps: string[];
  outputTemplates?: string[];
}): AgentSkill {
  const skill: AgentSkill = {
    id: `skill-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: input.title,
    triggerTags: input.triggerTags,
    applicableWhen: input.applicableWhen,
    recommendedSteps: input.recommendedSteps,
    outputTemplates: input.outputTemplates,
    createdAt: new Date().toISOString(),
  };
  const all = loadAll();
  // Avoid duplicates
  const exists = all.find((s) => s.title === skill.title);
  if (!exists) {
    all.push(skill);
    saveAll(all);
  }
  return exists || skill;
}

export function getSkills(tag?: string): AgentSkill[] {
  const all = loadAll();
  if (!tag) return all.slice(-20).reverse();
  return all
    .filter((s) => s.triggerTags.some((t) => t.toLowerCase().includes(tag.toLowerCase())))
    .slice(-10)
    .reverse();
}

export function getSkillById(id: string): AgentSkill | undefined {
  return loadAll().find((s) => s.id === id);
}

export function getAllSkills(): AgentSkill[] {
  return loadAll().slice(-20).reverse();
}

export function clearAllSkills(): void {
  try {
    localStorage.removeItem(SKILL_KEY);
  } catch {
    // ignore
  }
}
