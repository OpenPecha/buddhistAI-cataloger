import { calculateAnnotations } from './annotationCalculator';

/**
 * Validates that content ends with appropriate punctuation based on language
 * @param language - The language code (bo, en, zh, lzh, etc.)
 * @param content - The content to validate
 * @returns null if valid, or error message string if invalid
 */
export function validateContentEndsWithTsheg(language: string, content: string): string | null {
  // If content is empty, no validation needed
  if (!content || content.trim() === '') {
    return null;
  }

  // Trim trailing whitespace
  const trimmedContent = content.trimEnd();

  // Tibetan (bo): validate that text ends with ("།", "༔", "༎")
  if (language === 'bo') {
    const isValid = trimmedContent.endsWith('།') || 
           trimmedContent.endsWith('༔') || 
           trimmedContent.endsWith('༎');
    return isValid ? null : "Content must end with །, ༔, or ༎";
  }

  // English (en): validate that text ends with (".", "!", "?", ";", ":")
  if (language === 'en') {
    const isValid = trimmedContent.endsWith('.') || 
           trimmedContent.endsWith('!') || 
           trimmedContent.endsWith('?') || 
           trimmedContent.endsWith(';') || 
           trimmedContent.endsWith(':');
    return isValid ? null : "Content must end with ., !, ?, ;, or :";
  }

  // Chinese (zh, lzh): validate that text ends with ("。", "！", "？", "；", "、")
  if (language === 'zh' || language === 'lzh') {
    const isValid = trimmedContent.endsWith('。') || 
           trimmedContent.endsWith('！') || 
           trimmedContent.endsWith('？') || 
           trimmedContent.endsWith('；') || 
           trimmedContent.endsWith('、');
    return isValid ? null : "Content must end with 。, ！, ？, ；, or 、";
  }

  // For other languages, no validation required (return null)
  return null;
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

