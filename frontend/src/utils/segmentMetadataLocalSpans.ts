/** Character range within segment.text for title or author highlighting. */
export type SegmentMetadataLocalSpan = {
  start: number;
  end: number;
  kind: 'title' | 'author';
};

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

function phraseLocalSpan(
  text: string,
  phrase: string | null | undefined
): { start: number; end: number } | null {
  if (!phrase) return null;
  const trimmed = phrase.trim();
  if (!trimmed) return null;
  let idx = text.indexOf(trimmed);
  let len = trimmed.length;
  if (idx === -1 && phrase !== trimmed) {
    idx = text.indexOf(phrase);
    len = phrase.length;
  }
  if (idx === -1) return null;
  return { start: idx, end: idx + len };
}

function resolveMetadataLocalSpan(
  text: string,
  segmentDocStart: number,
  segmentDocEnd: number,
  docStart: number | null | undefined,
  docEnd: number | null | undefined,
  primaryPhrase: string | null | undefined,
  fallbackPhrase: string | null | undefined
): { start: number; end: number } | null {
  if (docStart != null && docEnd != null) {
    const fromDoc = docSpanToLocal(docStart, docEnd, segmentDocStart, segmentDocEnd, text.length);
    if (fromDoc) return fromDoc;
  }
  return phraseLocalSpan(text, primaryPhrase) ?? phraseLocalSpan(text, fallbackPhrase);
}

/** Local title/author ranges inside segment body text (for reviewer in-segment highlights). */
export function getSegmentMetadataLocalSpans(
  segment: SegmentForMetadataHighlight
): SegmentMetadataLocalSpan[] {
  const { text, span_start: segmentDocStart, span_end: segmentDocEnd } = segment;
  const spans: SegmentMetadataLocalSpan[] = [];

  const titleLocal = resolveMetadataLocalSpan(
    text,
    segmentDocStart,
    segmentDocEnd,
    segment.title_span_start,
    segment.title_span_end,
    segment.title,
    segment.updated_title
  );
  if (titleLocal) spans.push({ ...titleLocal, kind: 'title' });

  const authorLocal = resolveMetadataLocalSpan(
    text,
    segmentDocStart,
    segmentDocEnd,
    segment.author_span_start,
    segment.author_span_end,
    segment.author,
    segment.updated_author
  );
  if (authorLocal) spans.push({ ...authorLocal, kind: 'author' });

  return spans;
}
