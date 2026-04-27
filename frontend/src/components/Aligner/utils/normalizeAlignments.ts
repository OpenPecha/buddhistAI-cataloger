/**
 * OpenPecha may return one alignment object or several (array or wrapped lists).
 * Normalize to a list of { id, label, data } for UI selection and reconstruction.
 */

export type AlignmentAnnotationPayload = {
  target_annotation: unknown[] | null | undefined;
  alignment_annotation: unknown[] | null | undefined;
};

export type NormalizedAlignmentVariant = {
  id: string | null;
  label: string;
  data: AlignmentAnnotationPayload;
};

function isAlignmentShape(o: unknown): o is AlignmentAnnotationPayload {
  if (!o || typeof o !== "object") return false;
  const x = o as Record<string, unknown>;
  return Array.isArray(x.target_annotation) && Array.isArray(x.alignment_annotation);
}

/** OpenPecha list API: segments with `lines` spans and optional `alignment_indices`. */
type ApiLineSpan = { start?: number; end?: number };

function mergeLinesToSpan(lines: ApiLineSpan[] | undefined): { start: number; end: number } | null {
  if (!lines?.length) return null;
  let start = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;
  for (const l of lines) {
    if (typeof l?.start !== "number" || typeof l?.end !== "number") continue;
    start = Math.min(start, l.start);
    end = Math.max(end, l.end);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return null;
  return { start, end };
}

function isSegmentStyleAlignment(o: unknown): o is Record<string, unknown> {
  if (!o || typeof o !== "object") return false;
  const x = o as Record<string, unknown>;
  return Array.isArray(x.target_segments) && Array.isArray(x.aligned_segments);
}

/**
 * Convert OpenPecha segment alignment (`target_segments` / `aligned_segments`) to the
 * legacy shape expected by `reconstructSegments`:
 * - `target_annotation[i]` spans **source** (aligned edition) text
 * - `alignment_annotation[i]` spans **target** (root) text
 */
function segmentStyleToLegacyPayload(rec: Record<string, unknown>): AlignmentAnnotationPayload | null {
  const targetSegments = rec.target_segments as Array<{ lines?: ApiLineSpan[] }> | undefined;
  const alignedSegments = rec.aligned_segments as Array<{
    lines?: ApiLineSpan[];
    alignment_indices?: number[];
  }> | undefined;
  if (!Array.isArray(targetSegments) || !Array.isArray(alignedSegments)) return null;

  const target_annotation: unknown[] = [];
  const alignment_annotation: unknown[] = [];

  const findAlignedSpanForIndex = (j: number): { start: number; end: number } | null => {
    const spans: { start: number; end: number }[] = [];
    for (const al of alignedSegments) {
      const indices = Array.isArray(al.alignment_indices) ? al.alignment_indices : [];
      if (!indices.includes(j)) continue;
      const s = mergeLinesToSpan(al.lines);
      if (s) spans.push(s);
    }
    if (spans.length === 0) return null;
    return {
      start: Math.min(...spans.map((s) => s.start)),
      end: Math.max(...spans.map((s) => s.end)),
    };
  };

  for (let j = 0; j < targetSegments.length; j++) {
    const targetSpan = mergeLinesToSpan(targetSegments[j]?.lines);
    const alignedSpan = findAlignedSpanForIndex(j);

    if (!targetSpan && !alignedSpan) {
      target_annotation.push(null);
      alignment_annotation.push(null);
      continue;
    }

    const idxStr = String(j);
    const rowId = `seg-${idxStr}`;
    if (targetSpan && alignedSpan) {
      target_annotation.push({
        index: idxStr,
        span: alignedSpan,
        id: rowId,
      });
      alignment_annotation.push({
        index: idxStr,
        span: targetSpan,
        id: rowId,
      });
    } else if (targetSpan && !alignedSpan) {
      alignment_annotation.push({
        index: idxStr,
        span: targetSpan,
        id: rowId,
      });
      target_annotation.push(null);
    } else if (alignedSpan) {
      target_annotation.push({
        index: idxStr,
        span: alignedSpan,
        id: rowId,
      });
      alignment_annotation.push(null);
    }
  }

  return {
    target_annotation,
    alignment_annotation,
  };
}

function extractAnnotationId(rec: Record<string, unknown>): string | null {
  if (typeof rec.id === "string") return rec.id;
  if (typeof rec.annotation_id === "string") return rec.annotation_id;
  return null;
}

function variantFromObject(o: unknown, index: number): NormalizedAlignmentVariant | null {
  const rec = typeof o === "object" && o !== null ? (o as Record<string, unknown>) : null;
  if (!rec) return null;

  const id = extractAnnotationId(rec);
  const explicitLabel =
    (typeof rec.name === "string" && rec.name.trim()) ||
    (typeof rec.title === "string" && rec.title.trim()) ||
    (typeof rec.label === "string" && rec.label.trim()) ||
    "";
  const label = explicitLabel || `Alignment ${index + 1}`;

  if (isAlignmentShape(o)) {
    return {
      id,
      label,
      data: {
        target_annotation: rec.target_annotation as unknown[],
        alignment_annotation: rec.alignment_annotation as unknown[],
      },
    };
  }

  if (isSegmentStyleAlignment(rec)) {
    const data = segmentStyleToLegacyPayload(rec);
    if (!data) return null;
    return { id, label, data };
  }

  return null;
}

/**
 * Extract zero or more alignment variants from API `annotation` field.
 */
export function normalizeAlignmentPayload(raw: unknown): NormalizedAlignmentVariant[] {
  if (raw == null) return [];

  if (Array.isArray(raw)) {
    return raw
      .map((item, i) => variantFromObject(item, i))
      .filter((v): v is NormalizedAlignmentVariant => v !== null);
  }

  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const key of ["alignments", "items", "data", "results"] as const) {
      const inner = o[key];
      if (Array.isArray(inner)) {
        const nested = normalizeAlignmentPayload(inner);
        if (nested.length > 0) return nested;
      }
    }
    const single = variantFromObject(raw, 0);
    return single ? [single] : [];
  }

  return [];
}
