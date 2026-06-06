export function splitParagraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

const SENTENCE_SPLIT = /(?<=[.!?])\s+(?=[A-Z(])/g;

export function splitSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  return cleaned
    .split(SENTENCE_SPLIT)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

export function wordCount(text: string): number {
  const matches = text.match(/\b[\w'-]+\b/g);
  return matches ? matches.length : 0;
}

export function characterCount(text: string): number {
  return text.length;
}

export function snippet(text: string, maxChars = 600): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut) + "…";
}

export function topByFrequency<T extends string>(
  items: T[],
  limit: number,
): { value: T; count: number }[] {
  const counts = new Map<T, number>();
  for (const it of items) counts.set(it, (counts.get(it) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

export function dedupe<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}
