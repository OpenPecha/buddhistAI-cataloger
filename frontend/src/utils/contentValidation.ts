import { calculateAnnotations } from './annotationCalculator';

/**
 * Validates that content ends with Tibetan tsheg (།)
 * @param content - The content to validate
 * @returns true if content is empty or ends with །, false otherwise
 */
export function validateContentEndsWithTsheg(content: string): boolean {
  // If content is empty, no validation needed
  if (!content || content.trim() === '') {
    return true;
  }
  
  // Trim trailing whitespace and check if it ends with །
  const trimmedContent = content.trimEnd();
  return trimmedContent.endsWith('།');
}

/**
 * Character limit per segment (can be easily changed)
 */
export const SEGMENT_CHAR_LIMIT = 2400;

/**
 * Validates segment character limits
 * @param content - The content to validate
 * @returns Object with validation results including invalid segments and count
 */
export function validateSegmentLimits(content: string): {
  isValid: boolean;
  invalidSegments: Array<{ index: number; length: number; start: number; end: number }>;
  invalidCount: number;
} {
  if (!content || content.trim() === '') {
    return { isValid: true, invalidSegments: [], invalidCount: 0 };
  }

  const { annotations } = calculateAnnotations(content);

  const invalidSegments: Array<{ index: number; length: number; start: number; end: number }> = [];

  annotations.forEach((annotation: { span: { start: number; end: number } }, index: number) => {
    const segmentLength = annotation.span.end - annotation.span.start;
    if (segmentLength > SEGMENT_CHAR_LIMIT) {
      invalidSegments.push({
        index,
        length: segmentLength,
        start: annotation.span.start,
        end: annotation.span.end,
      });
    }
  });

  return {
    isValid: invalidSegments.length === 0,
    invalidSegments,
    invalidCount: invalidSegments.length,
  };
}

