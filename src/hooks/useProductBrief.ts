import { useState, useEffect, useCallback } from 'react';
import type { ProductBrief, StepKey, StepData } from '../types';

const STORAGE_KEY = 'vibepilot_briefs';
const CURRENT_KEY = 'vibepilot_current_id';

function createEmptyStep(): StepData {
  return {
    userAnswer: '',
    aiEvaluation: '',
    aiQuality: 'vague',
    aiFollowUp: '',
    isCompleted: false,
  };
}

function createEmptyBrief(id: string, rawIdea: string): ProductBrief {
  const steps: Record<string, StepData> = {};
  const keys: StepKey[] = [
    'targetUser', 'scenario', 'painPoint', 'alternatives',
    'aiValue', 'mvpScope', 'outOfScope', 'techStack',
    'dataStructure', 'acceptanceCriteria',
  ];
  keys.forEach((k) => {
    steps[k] = createEmptyStep();
  });
  return {
    id,
    createdAt: new Date().toISOString(),
    rawIdea,
    steps,
    developmentPrompt: '',
  };
}

export function useProductBrief(id?: string) {
  const [brief, setBrief] = useState<ProductBrief | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      const all = loadAll();
      const found = all.find((b) => b.id === id);
      if (found) {
        setBrief(found);
      } else {
        setBrief(createEmptyBrief(id, ''));
      }
    }
    setLoading(false);
  }, [id]);

  const save = useCallback((updated: ProductBrief) => {
    setBrief(updated);
    const all = loadAll();
    const idx = all.findIndex((b) => b.id === updated.id);
    if (idx >= 0) {
      all[idx] = updated;
    } else {
      all.push(updated);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }, []);

  const initBrief = useCallback((rawIdea: string): ProductBrief => {
    const newId = `pb-${Date.now()}`;
    const newBrief = createEmptyBrief(newId, rawIdea);
    save(newBrief);
    localStorage.setItem(CURRENT_KEY, newId);
    return newBrief;
  }, [save]);

  const updateStep = useCallback(
    (stepKey: string, data: Partial<StepData>) => {
      if (!brief) return;
      const updated = {
        ...brief,
        steps: {
          ...brief.steps,
          [stepKey]: { ...brief.steps[stepKey], ...data },
        },
      };
      save(updated);
    },
    [brief, save]
  );

  return { brief, loading, save, initBrief, updateStep };
}

function loadAll(): ProductBrief[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getCurrentBriefId(): string | null {
  return localStorage.getItem(CURRENT_KEY);
}
