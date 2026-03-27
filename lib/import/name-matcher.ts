/**
 * Fuzzy player name matching using Levenshtein distance.
 * Used to reconcile inconsistent names across CSV/XLSX sources.
 */

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')      // collapse multiple spaces / tabs
    .replace(/[^a-z\s]/g, ''); // strip non-alpha
}

export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function similarity(a: string, b: string): number {
  const na = normalizeName(a), nb = normalizeName(b);
  if (na === nb) return 1.0;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshtein(na, nb);
  const rawScore = 1 - dist / maxLen;
  // Also check token-sorted similarity to handle reversed names like "Alpesh Baria" vs "Baria Alpesh"
  const sortedA = na.split(' ').sort().join(' ');
  const sortedB = nb.split(' ').sort().join(' ');
  if (sortedA === sortedB) return 1.0;
  const sortedMax = Math.max(sortedA.length, sortedB.length);
  const sortedScore = 1 - levenshtein(sortedA, sortedB) / sortedMax;
  return Math.max(rawScore, sortedScore);
}

export interface MatchResult {
  id: string;
  name: string;
  score: number;
}

export function findBestMatch(
  name: string,
  candidates: { id: string; name: string }[],
  threshold = 0.80
): MatchResult | null {
  // Normalize input: trim and collapse spaces
  const cleanName = name ? name.trim().replace(/\s+/g, ' ') : '';
  if (!cleanName) return null;

  let best: MatchResult | null = null;
  for (const c of candidates) {
    const score = similarity(cleanName, c.name);
    if (score >= threshold && (!best || score > best.score)) {
      best = { id: c.id, name: c.name, score };
    }
  }

  // First-name-only boost: if input is a single word, try matching against
  // the first token of each candidate name at a slightly higher threshold
  if (!best && cleanName && !cleanName.includes(' ')) {
    const singleWordThreshold = Math.max(threshold, 0.88);
    for (const c of candidates) {
      const firstToken = c.name.split(' ')[0];
      if (!firstToken) continue;
      const score = similarity(cleanName, firstToken);
      if (score >= singleWordThreshold && (!best || score > best.score)) {
        best = { id: c.id, name: c.name, score };
      }
    }
  }

  return best;
}

export function findAllMatches(
  name: string,
  candidates: { id: string; name: string }[],
  threshold = 0.75
): MatchResult[] {
  return candidates
    .map(c => ({ id: c.id, name: c.name, score: similarity(name, c.name) }))
    .filter(m => m.score >= threshold)
    .sort((a, b) => b.score - a.score);
}
