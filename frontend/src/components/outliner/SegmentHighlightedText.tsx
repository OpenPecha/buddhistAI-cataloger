import { useMemo } from 'react';
import Highlighter from 'react-highlight-words';
import { normalizeSearchQuery } from '@/features/outliner';

const HIGHLIGHT_CLASS = {
  title: 'segment-highlight-title rounded-sm bg-sky-200/85 box-decoration-clone',
  author: 'segment-highlight-author rounded-sm bg-violet-200/85 box-decoration-clone',
  search: 'highlighter rounded-sm bg-amber-200/90 box-decoration-clone',
} as const;

export interface SegmentHighlightedTextProps {
  text: string;
  /** Title substrings to mark in the body (sky blue). */
  titleWords?: string[];
  /** Author substrings to mark in the body (violet). */
  authorWords?: string[];
  /** In-segment search terms (amber; uses `.highlighter` for match navigation). */
  searchWords?: string[];
  className?: string;
}

function removeLastTwoTsek(word: string): string {
  const TSEK = '་';
  const parts = word.split(TSEK);
  // Remove any empty strings from accidental trailing tseks
  const nonEmptyParts = parts.filter((part) => part.length > 0);

  // Split the word into characters, leave last 2 characters, merge them
  if (nonEmptyParts.length <= 2) {
    const chars = Array.from(word.trim());
    return chars.slice(0, -2).join('');
  }
  // Join all but the last two
  return nonEmptyParts.slice(0, -1).join(TSEK) + TSEK;
}

/** Title/author words: legacy tsek-trimming highlight behavior (unchanged). */
function metadataWords(words: string[] | undefined): string[] {
  return (words ?? []).map((w) => removeLastTwoTsek(w.trim())).filter(Boolean);
}

/** Search words: shad-aware normalization so the match is exact, not chopped. */
function normalizedSearchWords(words: string[] | undefined): string[] {
  return (words ?? []).map((w) => normalizeSearchQuery(w)).filter(Boolean);
}

export function SegmentHighlightedText({
  text,
  titleWords = [],
  authorWords = [],
  searchWords = [],
  className,
}: SegmentHighlightedTextProps) {
  const wordClass = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of metadataWords(titleWords)) map.set(w, HIGHLIGHT_CLASS.title);
    for (const w of metadataWords(authorWords)) map.set(w, HIGHLIGHT_CLASS.author);
    for (const w of normalizedSearchWords(searchWords)) map.set(w, HIGHLIGHT_CLASS.search);
    return map;
  }, [titleWords, authorWords, searchWords]);

  const allSearchWords = useMemo(
    () => [
      ...metadataWords(titleWords),
      ...metadataWords(authorWords),
      ...normalizedSearchWords(searchWords),
    ],
    [titleWords, authorWords, searchWords]
  );

  if (!text) return null;

  if (allSearchWords.length === 0) {
    return <span className={className}>{text}</span>;
  }

  return (
    <Highlighter
      className={className}
      searchWords={allSearchWords}
      autoEscape
      textToHighlight={text}
      highlightTag={({ children }) => (
        <mark className={wordClass.get(String(children)) ?? HIGHLIGHT_CLASS.search}>
          {children}
        </mark>
      )}
    />
  );
}
