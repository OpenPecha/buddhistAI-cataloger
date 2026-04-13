/**
 * Outliner segment body = document.content[span_start, span_end).
 * The API omits per-segment text; resolve locally from full document content.
 */
export function segmentBodyFromDocument(
  content: string | undefined | null,
  spanStart: number,
  spanEnd: number
): string {
  if (content == null || content === '') return '';
  const n = content.length;
  const s = Math.max(0, Math.min(spanStart, n));
  const e = Math.max(s, Math.min(spanEnd, n));
  return content.slice(s, e);
}

type DocWithSegments = {
  content?: string;
  segments?: Array<{ span_start: number; span_end: number; text?: string | null }>;
};

export function withResolvedSegmentTexts<T extends DocWithSegments>(doc: T): T {
  if (!doc.segments?.length) return doc;
  const content = doc.content ?? '';
  return {
    ...doc,
    segments: doc.segments.map((seg) => ({
      ...seg,
      text: segmentBodyFromDocument(content, seg.span_start, seg.span_end),
    })),
  };
}
