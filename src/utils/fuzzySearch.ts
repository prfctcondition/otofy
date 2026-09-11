/**
 * Fast, lightweight fuzzy string matching with tokenization and Damerau-Levenshtein distance.
 */
function damerauLevenshtein(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  const matrix: number[][] = [];
  for (let i = 0; i <= al; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= bl; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );

      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1); // transposition
      }
    }
  }

  return matrix[al][bl];
}

/**
 * Checks if search query fuzzy-matches target string.
 * Allows 1 typo for short words (<= 5 chars) and 2 typos for longer words.
 */
export function fuzzyMatch(query: string, target?: string): boolean {
  if (!query) return true;
  if (!target) return false;

  const q = query.trim().toLowerCase();
  const t = target.toLowerCase();

  // Direct substring match
  if (t.includes(q)) return true;

  // Word token matching
  const queryWords = q.split(/\s+/).filter(Boolean);
  const targetWords = t.split(/\s+/).filter(Boolean);

  // If every query word matches at least one target word
  return queryWords.every((qWord) => {
    // Exact prefix or contains
    if (targetWords.some((tWord) => tWord.includes(qWord) || qWord.includes(tWord))) {
      return true;
    }

    // Levenshtein distance check on word basis
    const maxDist = qWord.length <= 4 ? 1 : 2;
    return targetWords.some((tWord) => {
      // Don't compare drastically different word lengths
      if (Math.abs(tWord.length - qWord.length) > maxDist) return false;
      return damerauLevenshtein(qWord, tWord) <= maxDist;
    });
  });
}
