import { cleaned_alignments } from "./alignment_generator";


type Span = {
    start: number;
    end: number;
  };
  
  type Annotation = {
    id?: string | null;
    index?: string;     // index as string (optional for backward compatibility)
    span: Span;
    aligned_segments?: string[];  // optional aligned_segments
  };
  
  type AlignmentAnnotation = {
    id?: string | null;
    index?: string;           // index as string (optional for backward compatibility)
    span: Span;
    alignment_index?: string[];  // one-to-one mapping (optional for backward compatibility)
    aligned_segments?: string[];  // aligned segments array
  };
  
  type AlignmentResult = {
    type: "alignment";
    target_annotation: Annotation[];
    alignment_annotation: AlignmentAnnotation[];
  };
  
  export function generateAlignment(a: string[], b: string[]): AlignmentResult {
    const target_annotation: Annotation[] = [];
    const alignment_annotation: AlignmentAnnotation[] = [];
    // --- Build target_annotation from a[] ---
    let aCursor = 0; // cumulative span
  
    a.forEach((text, i) => {
      const length = text.length;
      const start = aCursor;
      const end = aCursor + length;
        target_annotation.push({
          index: String(i),
          span: { start, end }
        });
  
      if (length > 0) {
        aCursor = end; // only advance when non-empty
      }
    });
  
    // --- Build alignment_annotation from b[] ---
    let bCursor = 0;
  
    b.forEach((text, i) => {
      const length = text.length;
      const start = bCursor;
      const end = bCursor + length;
      
      alignment_annotation.push({
          index: String(i),
          span: { start, end },
          alignment_index: [String(i)]  // strict 1-to-1 mapping
        });
  
      if (length > 0) {
        bCursor = end;
      }
    });
    const temp={
      type: "alignment" as const,
      target_annotation,
      alignment_annotation
    };
    // Type assertion needed due to different Annotation types between files
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const alignmentGenerated= cleaned_alignments(temp as any);

    // cleaned_alignments filters out nulls, so we can safely cast to AlignmentResult
    return alignmentGenerated as AlignmentResult
  }





  /**
   * Reconstructs source and target segment arrays from annotations and content.
   * This is the inverse operation of generateAlignment.
   * Groups unlisted indices (gaps between annotations) together.
   * 
   * @param target_annotation - Annotations with spans for source content (may contain null values)
   * @param alignment_annotation - Annotations with spans for target content (may contain null values)
   * @param sourceContent - Full source text content
   * @param targetContent - Full target text content
   * @returns Object containing source and target segment arrays
   */
  export function reconstructSegments(
    target_annotation: (Annotation | null)[],
    alignment_annotation: (Annotation | AlignmentAnnotation | null)[],
    sourceContent: string,
    targetContent: string
  ): { source: string[]; target: string[] } {
    const source: string[] = [];
    const target: string[] = [];

    // Track positions in content for both source and target
    let sourceLastEnd = 0;
    let targetLastEnd = 0;

    // Process both arrays simultaneously to maintain alignment
    const maxLength = Math.max(target_annotation.length, alignment_annotation.length);

    for (let i = 0; i < maxLength; i++) {
      const targetAnn = target_annotation[i] ?? null;
      const alignmentAnn = alignment_annotation[i] ?? null;

      // Check if annotations exist and if their id is null or undefined
      const targetAnnIdNull = !targetAnn || targetAnn.id == null;
      const alignmentAnnIdNull = !alignmentAnn || alignmentAnn.id == null;

      // Handle cases where id is null: add empty line to the other array
      if (targetAnnIdNull && alignmentAnnIdNull) {
        // Both have null id - add empty lines to both to maintain alignment
        // source.push('');
        // target.push('');
      } else if (targetAnnIdNull && !alignmentAnnIdNull && alignmentAnn !== null) {
        // Target annotation id is null - add empty line to source, process target content
        source.push('');
        
        // Process gap before this alignment annotation
        if (alignmentAnn.span.start > targetLastEnd) {
          const gapText = targetContent.substring(targetLastEnd, alignmentAnn.span.start);
          if (gapText.trim().length > 0 || gapText.length > 0) {
            target.push(gapText);
          }
        }
        
        // Add the alignment annotation segment
        const segmentText = targetContent.substring(alignmentAnn.span.start, alignmentAnn.span.end);
        target.push(segmentText);
        targetLastEnd = alignmentAnn.span.end;
      } else if (alignmentAnnIdNull && !targetAnnIdNull && targetAnn !== null) {
        // Alignment annotation id is null - add empty line to target, process source content
        target.push('');
        
        // Process gap before this target annotation
        if (targetAnn.span.start > sourceLastEnd) {
          const gapText = sourceContent.substring(sourceLastEnd, targetAnn.span.start);
          if (gapText.trim().length > 0 || gapText.length > 0) {
            source.push(gapText);
          }
        }
        
        // Add the target annotation segment
        const segmentText = sourceContent.substring(targetAnn.span.start, targetAnn.span.end);
        source.push(segmentText);
        sourceLastEnd = targetAnn.span.end;
      } else if (!targetAnnIdNull && !alignmentAnnIdNull && targetAnn !== null && alignmentAnn !== null) {
        // Both annotations have valid ids - process both simultaneously
        
        // Process gaps before annotations
        if (targetAnn.span.start > sourceLastEnd) {
          const gapText = sourceContent.substring(sourceLastEnd, targetAnn.span.start);
          if (gapText.trim().length > 0 || gapText.length > 0) {
            source.push(gapText);
            // Add corresponding empty line to target to maintain alignment
            target.push('');
          }
        }
        
        if (alignmentAnn.span.start > targetLastEnd) {
          const gapText = targetContent.substring(targetLastEnd, alignmentAnn.span.start);
          if (gapText.trim().length > 0 || gapText.length > 0) {
            target.push(gapText);
            // Add corresponding empty line to source to maintain alignment
            source.push('');
          }
        }
        
        // Add both annotation segments
        const sourceSegment = sourceContent.substring(targetAnn.span.start, targetAnn.span.end);
        const targetSegment = targetContent.substring(alignmentAnn.span.start, alignmentAnn.span.end);
        source.push(sourceSegment);
        target.push(targetSegment);
        
        sourceLastEnd = targetAnn.span.end;
        targetLastEnd = alignmentAnn.span.end;
      }
    }

    // Handle any remaining content after the last annotations
    if (sourceLastEnd < sourceContent.length) {
      const remainingText = sourceContent.substring(sourceLastEnd);
      if (remainingText.trim().length > 0 || remainingText.length > 0) {
        source.push(remainingText);
        target.push(''); // Add empty line to target to maintain alignment
      }
    }

    if (targetLastEnd < targetContent.length) {
      const remainingText = targetContent.substring(targetLastEnd);
      if (remainingText.trim().length > 0 || remainingText.length > 0) {
        target.push(remainingText);
        source.push(''); // Add empty line to source to maintain alignment
      }
    }

    return { source, target };
  }
  