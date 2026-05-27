export type SegmentForMetadataHighlight = {
  text: string;
  span_start: number;
  span_end: number;
  title?: string | null;
  author?: string | null;
  title_span_start?: number | null;
  title_span_end?: number | null;
  author_span_start?: number | null;
  author_span_end?: number | null;
  updated_title?: string | null;
  updated_author?: string | null;
};

export type SegmentHighlightWords = {
  titleWords: string[];
  authorWords: string[];
};

const TSEK = '་';

function docSpanToLocal(
  docStart: number,
  docEnd: number,
  segmentDocStart: number,
  segmentDocEnd: number,
  textLen: number
): { start: number; end: number } | null {
  if (docEnd <= docStart) return null;
  if (docStart < segmentDocStart || docEnd > segmentDocEnd) return null;
  const start = docStart - segmentDocStart;
  const end = docEnd - segmentDocStart;
  if (start < 0 || end > textLen || start >= end) return null;
  return { start, end };
}

function phraseInText(text: string, phrase: string): boolean {
  const trimmed = phrase.trim();
  if (!trimmed) return false;
  return text.includes(trimmed) || (phrase !== trimmed && text.includes(phrase));
}

function effectiveTitlePhrase(segment: SegmentForMetadataHighlight): string | null {
  const value = (segment.title ?? segment.updated_title ?? '').trim();
  return value || null;
}

function effectiveAuthorPhrase(segment: SegmentForMetadataHighlight): string | null {
  const value = (segment.author ?? segment.updated_author ?? '').trim();
  return value || null;
}

/** True when title and author strings appear back-to-back in the text with only ་ between them. */
function areTitleAuthorSeparatedByTsek(
  text: string,
  titlePhrase: string | null,
  authorPhrase: string | null
): boolean {
  if (!titlePhrase || !authorPhrase) return false;
  if (text.includes(`${titlePhrase}${TSEK}${authorPhrase}`)) return true;

  const titleIdx = text.indexOf(titlePhrase);
  const authorIdx = text.indexOf(authorPhrase);
  if (titleIdx === -1 || authorIdx === -1 || authorIdx <= titleIdx) return false;

  const between = text.slice(titleIdx + titlePhrase.length, authorIdx);
  return between.length > 0 && [...between].every((ch) => ch === TSEK);
}

/**
 * When title/author are ་-adjacent in the body, highlight the last two ་-delimited
 * segments of each phrase (Python `parts[-2:]` joined with ་).
 */
function phraseForTsekSeparatedHighlight(phrase: string): string {
  const trimmed = phrase.trim();
  if (!trimmed) return trimmed;
  const parts = trimmed.split(TSEK).filter((p) => p.length > 0);
  if (parts.length <= 2) return trimmed;
  const joined = parts.slice(-2).join(TSEK);
  return trimmed.endsWith(TSEK) ? `${joined}${TSEK}` : joined;
}

function resolveHighlightPhrase(
  text: string,
  segmentDocStart: number,
  segmentDocEnd: number,
  docStart: number | null | undefined,
  docEnd: number | null | undefined,
  primaryPhrase: string | null | undefined,
  fallbackPhrase: string | null | undefined,
  separatedByTsek: boolean
): string | null {
  if (docStart != null && docEnd != null) {
    const fromDoc = docSpanToLocal(docStart, docEnd, segmentDocStart, segmentDocEnd, text.length);
    if (fromDoc) {
      const raw = text.slice(fromDoc.start, fromDoc.end);
      const phrase = separatedByTsek ? phraseForTsekSeparatedHighlight(raw) : raw;
      return phraseInText(text, phrase) ? phrase.trim() : null;
    }
  }

  const candidates = [primaryPhrase, fallbackPhrase].filter(
    (p): p is string => Boolean(p?.trim())
  );
  const uniqueCandidates = [...new Set(candidates.map((p) => p.trim()))];

  for (const candidate of uniqueCandidates) {
    const phrase = separatedByTsek ? phraseForTsekSeparatedHighlight(candidate) : candidate;
    if (phraseInText(text, phrase)) return phrase.trim();
  }

  return null;
}

/** Substrings to pass to Highlighter for reviewer title/author in-segment marks. */
export function getSegmentHighlightWords(
  segment: SegmentForMetadataHighlight
): SegmentHighlightWords {
  const { text, span_start: segmentDocStart, span_end: segmentDocEnd } = segment;

  const authorPhrase = effectiveAuthorPhrase(segment);

  const titleWord = resolveHighlightPhrase(
    text,
    segmentDocStart,
    segmentDocEnd,
    segment.title_span_start,
    segment.title_span_end,
    segment.title,
    segment.updated_title,
    false
  );


  return {
    titleWords: titleWord ? [titleWord] : [],
    authorWords: authorPhrase ? [authorPhrase] : [],
  };
}
