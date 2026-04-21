/**
 * Build alignment payload in this format:
 * {
 *   target_id: "string",
 *   target_segments: [
 *     { lines: [{ start: 0, end: 1 }] }
 *   ],
 *   aligned_segments: [
 *     { lines: [{ start: 0, end: 1 }], alignment_indices: [0] }
 *   ],
 *   metadata: {}
 * }
 */

function spanNonEmpty(span) {
    return span.start < span.end;
  }
  
  function buildSpans(segments) {
    const rows = [];
    let cursor = 0;
  
    for (let i = 0; i < segments.length; i++) {
      const text = segments[i] ?? "";
      const length = text.length;
      const start = cursor;
      const end = cursor + length;
  
      rows.push({
        index: i,
        lines: [{ start, end }],
      });
  
      if (length > 0) {
        cursor = end;
      }
    }
  
    return rows;
  }
  
  function buildAlignedSpans(segments) {
    const rows = [];
    let cursor = 0;
  
    for (let i = 0; i < segments.length; i++) {
      const text = segments[i] ?? "";
      const length = text.length;
      const start = cursor;
      const end = cursor + length;
  
      rows.push({
        index: i,
        lines: [{ start, end }],
        alignment_indices: [i],
      });
  
      if (length > 0) {
        cursor = end;
      }
    }
  
    return rows;
  }
  
  function filterToMutuallyPairedRows(targetRows, alignedRows) {
    const tBy = new Map(targetRows.map((row) => [row.index, row]));
    const aBy = new Map(alignedRows.map((row) => [row.index, row]));
  
    const allIndices = [...new Set([...tBy.keys(), ...aBy.keys()])].sort((a, b) => a - b);
  
    const filteredTargets = [];
    const filteredAligned = [];
  
    for (const oldIndex of allIndices) {
      const t = tBy.get(oldIndex);
      const a = aBy.get(oldIndex);
  
      if (!t || !a) continue;
  
      const tSpan = t.lines[0];
      const aSpan = a.lines[0];
  
      if (!spanNonEmpty(tSpan) || !spanNonEmpty(aSpan)) continue;
  
      const newIndex = filteredTargets.length;
  
      filteredTargets.push({
        lines: [{ start: tSpan.start, end: tSpan.end }],
      });
  
      filteredAligned.push({
        lines: [{ start: aSpan.start, end: aSpan.end }],
        alignment_indices: [newIndex],
      });
    }
  
    return {
      target_segments: filteredTargets,
      aligned_segments: filteredAligned,
    };
  }
  
  function segmentsToAlignmentPayload({
    targetId,
    targetTexts,
    alignedTexts,
    metadata = {},
  }) {
    const targetRows = buildSpans(targetTexts);
    const alignedRows = buildAlignedSpans(alignedTexts);
  
    const { target_segments, aligned_segments } = filterToMutuallyPairedRows(
      targetRows,
      alignedRows
    );
  
    return {
      target_id: targetId,
      target_segments,
      aligned_segments,
      metadata,
    };
  }
  
  // Example usage

  
  export default segmentsToAlignmentPayload;