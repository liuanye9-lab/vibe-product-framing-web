/**
 * Model Name Utils — V5.5
 *
 * Normalizes model names and diagnoses hidden characters,
 * special dashes, and other common copy-paste issues.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModelNameDiagnostics {
  original: string;
  normalized: string;
  changed: boolean;
  warnings: string[];
}

// ─── Normalize ────────────────────────────────────────────────────────────────

export function normalizeModelName(input: string): string {
  let result = input;

  // 1. Trim
  result = result.trim();

  // 2. Remove zero-width characters
  result = result.replace(/\u200B|\u200C|\u200D|\uFEFF/g, '');

  // 3. Replace Unicode dashes with standard hyphen
  result = result.replace(/\u2013|\u2014|\u2212|\uFF0D/g, '-');

  // 4. Collapse multiple spaces
  result = result.replace(/\s+/g, ' ');

  // 5. Trim again
  result = result.trim();

  return result;
}

// ─── Diagnose ─────────────────────────────────────────────────────────────────

export function diagnoseModelName(input: string): ModelNameDiagnostics {
  const warnings: string[] = [];
  const normalized = normalizeModelName(input);

  // Check for zero-width characters
  const zeroWidthChars = /\u200B|\u200C|\u200D|\uFEFF/;
  if (zeroWidthChars.test(input)) {
    warnings.push('检测到零宽字符（不可见），已自动移除。这类字符通常从网页复制时带入。');
  }

  // Check for special dashes
  const specialDashes = /\u2013|\u2014|\u2212|\uFF0D/;
  if (specialDashes.test(input)) {
    warnings.push('检测到特殊横线（en dash / em dash / 全角横线），已自动替换为普通连字符 "-"。');
  }

  // Check for leading/trailing spaces
  if (input !== input.trim()) {
    warnings.push('模型名前后有空格，已自动去除。');
  }

  // Check for multiple spaces
  if (/\s{2,}/.test(input)) {
    warnings.push('模型名中有多余空格，已自动合并。');
  }

  return {
    original: input,
    normalized,
    changed: input !== normalized,
    warnings,
  };
}
