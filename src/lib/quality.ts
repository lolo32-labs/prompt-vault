export interface QualityBreakdown {
  clarity: number;
  organization: number;
  variables: number;
  total: number;
}

export interface ScoreableItem {
  name: string;
  content: string;
  type: "prompt" | "skill";
}

const VAR_PATTERN = /\{\{([^}]+)\}\}/g;

/**
 * Clarity (0-100): rewards a workable length, penalizes walls of text.
 * - <20 chars: too thin to be a real prompt
 * - 20-40: short but usable
 * - 40-2000: the sweet spot
 * - 2000-8000: long; >8000: likely bloated
 * - >30% very long lines (>200 chars) further penalize readability
 */
function scoreClarity(content: string): number {
  const len = content.trim().length;
  let score: number;
  if (len < 20) score = 20;
  else if (len < 40) score = 50;
  else if (len <= 2000) score = 100;
  else if (len <= 8000) score = 80;
  else score = 60;

  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length > 0) {
    const longRatio = lines.filter((l) => l.length > 200).length / lines.length;
    score -= Math.round(longRatio * 40);
  }
  return Math.max(0, Math.min(100, score));
}

/**
 * Organization (0-100): rewards structural signals.
 * - markdown headings: 15 points each (max 45)
 * - bullet/numbered list lines: 5 points each (max 35)
 * - paragraph breaks (blank lines): up to 20 based on density
 */
function scoreOrganization(content: string): number {
  const lines = content.split("\n");
  const headings = lines.filter((l) => /^#{1,3}\s+\S/.test(l.trim())).length;
  const bullets = lines.filter((l) => /^\s*(?:[-*+]|\d+\.)\s+\S/.test(l)).length;
  const nonEmpty = lines.filter((l) => l.trim().length > 0).length;
  const blankLines = lines.length - nonEmpty;

  const headingPoints = Math.min(45, headings * 15);
  const bulletPoints = Math.min(35, bullets * 5);
  const paragraphDensity = nonEmpty > 0 ? blankLines / nonEmpty : 0;
  const paragraphPoints = Math.min(20, Math.round(paragraphDensity * 40));

  return Math.max(0, Math.min(100, headingPoints + bulletPoints + paragraphPoints));
}

/**
 * Variables (0-100): measures parameterization appropriateness.
 * - 0 vars: 60 (a static prompt is fine — neutral baseline, not a flaw)
 * - 1-4 unique vars: 100 (well-parameterized)
 * - 5-8: 80 (lots to fill in)
 * - >8: 60 (likely over-parameterized)
 * Repeated use of the same variable is good practice and doesn't count against.
 */
function scoreVariables(content: string): number {
  const matches = Array.from(content.matchAll(VAR_PATTERN)).map((m) => m[1].trim());
  const unique = new Set(matches).size;
  if (unique === 0) return 60;
  if (unique <= 4) return 100;
  if (unique <= 8) return 80;
  return 60;
}

/**
 * Deterministic, client-side quality score. No network, no LLM — every
 * subscore is explainable from the item's text alone.
 */
export function scorePrompt(item: ScoreableItem): QualityBreakdown {
  const clarity = scoreClarity(item.content);
  const organization = scoreOrganization(item.content);
  const variables = scoreVariables(item.content);
  const total = Math.round(clarity * 0.4 + organization * 0.35 + variables * 0.25);
  return { clarity, organization, variables, total };
}
