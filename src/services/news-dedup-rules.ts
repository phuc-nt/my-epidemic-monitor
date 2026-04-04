/**
 * Rule-based news title similarity — fast pre-filter before LLM dedup.
 * Uses Jaccard similarity on word sets after removing stop words.
 */

/** Common stop words to ignore when comparing titles (EN + VI). */
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'from', 'with', 'has', 'are', 'was',
  'này', 'các', 'của', 'trong', 'tại', 'cho', 'về',
]);

/**
 * Tokenize a title into a set of meaningful words.
 * Lowercases, splits on whitespace/punctuation, removes short tokens and stop words.
 */
function tokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .split(/[\s\p{P}]+/u)
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w));
  return new Set(tokens);
}

/**
 * Compute Jaccard similarity between two title word sets.
 * Returns a score in [0, 1] where 1 = identical word sets.
 */
export function titleSimilarity(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);

  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersectionSize = 0;
  for (const word of setA) {
    if (setB.has(word)) intersectionSize++;
  }

  const unionSize = setA.size + setB.size - intersectionSize;
  return intersectionSize / unionSize;
}

/**
 * Find duplicate pairs from a list of titles using Jaccard similarity.
 * Compares all pairs (i < j) and returns pairs where similarity > threshold.
 *
 * @param titles - Array of news titles to compare
 * @param threshold - Minimum similarity score to flag as duplicate (default 0.5)
 * @returns Array of [indexA, indexB] pairs where indexA < indexB
 */
export function findDuplicatesByTitle(
  titles: string[],
  threshold = 0.5,
): [number, number][] {
  const pairs: [number, number][] = [];

  for (let i = 0; i < titles.length - 1; i++) {
    for (let j = i + 1; j < titles.length; j++) {
      const score = titleSimilarity(titles[i], titles[j]);
      if (score > threshold) {
        pairs.push([i, j]);
      }
    }
  }

  return pairs;
}
