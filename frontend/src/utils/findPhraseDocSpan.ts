/** Document-level character span for a phrase found inside a segment's text. */
export type PhraseDocSpan = { start: number; end: number };

/**
 * Finds the first occurrence of `phrase` in `segmentText` and returns **document-level**
 * offsets by adding `segmentDocStart` (the segment's `span_start` in the full document).
 * Used when persisting AI (or other) title/author so span_start/end match the substring
 * inside that segment.
 */
export function findPhraseDocSpan(
  segmentText: string,
  segmentDocStart: number,
  phrase: string
): PhraseDocSpan | null {
  const trimmed = phrase.trim();
  if (!trimmed) return null;
  let idx = segmentText.indexOf(trimmed);
  let matchLen = trimmed.length;
  if (idx === -1 && phrase !== trimmed) {
    idx = segmentText.indexOf(phrase);
    matchLen = phrase.length;
  }
  if (idx === -1) return null;
  return { start: segmentDocStart + idx, end: segmentDocStart + idx + matchLen };
}
