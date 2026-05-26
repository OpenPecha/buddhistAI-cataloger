import React, { useMemo } from 'react';
import { findAllOccurrences } from '@/features/outliner';
import type { SegmentMetadataLocalSpan } from '@/utils/segmentMetadataLocalSpans';

type RangeKind = 'title' | 'author' | 'search';

type TaggedRange = {
  start: number;
  end: number;
  kind: RangeKind;
};

/** Background-only highlights: horizontal padding shifts the mirror layer vs the textarea. */
const KIND_CLASS: Record<RangeKind, string> = {
  title: 'segment-highlight-title rounded-sm bg-sky-200/85 box-decoration-clone',
  author: 'segment-highlight-author rounded-sm bg-violet-200/85 box-decoration-clone',
  search: 'highlighter rounded-sm bg-amber-200/90 box-decoration-clone',
};

function classForKinds(kinds: RangeKind[]): string {
  return [...new Set(kinds)].map((k) => KIND_CLASS[k]).join(' ');
}

function buildTaggedRanges(
  text: string,
  metadataSpans: SegmentMetadataLocalSpan[],
  searchQuery: string
): TaggedRange[] {
  const ranges: TaggedRange[] = [];
  const len = text.length;

  for (const s of metadataSpans) {
    const start = Math.max(0, Math.min(s.start, len));
    const end = Math.max(0, Math.min(s.end, len));
    if (start < end) ranges.push({ start, end, kind: s.kind });
  }

  const q = searchQuery.trim();
  if (q) {
    for (const o of findAllOccurrences(text, q)) {
      ranges.push({ start: o.start, end: o.end, kind: 'search' });
    }
  }

  return ranges;
}

function renderHighlightedText(
  text: string,
  metadataSpans: SegmentMetadataLocalSpan[],
  searchQuery: string
): React.ReactNode[] {
  if (!text) return [];

  const ranges = buildTaggedRanges(text, metadataSpans, searchQuery);
  if (ranges.length === 0) return [text];

  const boundaries = new Set<number>([0, text.length]);
  for (const r of ranges) {
    boundaries.add(r.start);
    boundaries.add(r.end);
  }
  const points = [...boundaries].sort((a, b) => a - b);
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    if (start >= end) continue;
    const slice = text.slice(start, end);
    const activeKinds = [
      ...new Set(
        ranges
          .filter((r) => r.start < end && r.end > start)
          .map((r) => r.kind)
      ),
    ];
    if (activeKinds.length === 0) {
      nodes.push(<React.Fragment key={start}>{slice}</React.Fragment>);
    } else {
      nodes.push(
        <mark key={start} className={classForKinds(activeKinds)}>
          {slice}
        </mark>
      );
    }
  }

  return nodes;
}

export interface SegmentHighlightedTextProps {
  text: string;
  metadataSpans?: SegmentMetadataLocalSpan[];
  searchQuery?: string;
  className?: string;
}

export function SegmentHighlightedText({
  text,
  metadataSpans = [],
  searchQuery = '',
  className,
}: SegmentHighlightedTextProps) {
  const content = useMemo(
    () => renderHighlightedText(text, metadataSpans, searchQuery),
    [text, metadataSpans, searchQuery]
  );

  return <span className={className}>{content}</span>;
}
