/**
 * Calculate line-by-line annotations for text content with newline-free output
 * 
 * Processing rules:
 * - Empty lines (length === 0) are removed and do NOT get span annotations
 * - Lines with any content (including just spaces) are kept and get span annotations
 * - Trailing empty lines are trimmed before processing
 * - All newline characters are removed from the final content
 * - Each span references positions in the cleaned, newline-free content
 * 
 * @param content - The full text content with newlines from the editor
 * @returns Object with annotations array and cleaned content (no newlines, no empty lines)
 */
export function calculateAnnotations(content: string): {
  annotations: Array<{ span: { start: number; end: number } }>;
  cleanedContent: string;
} {
  // Handle empty content
  if (!content || !content.trim()) {
    return { annotations: [], cleanedContent: '' };
  }

  // Split by newline and trim trailing empty lines
  let lines = content.split('\n');
  
  // Remove trailing empty lines
  while (lines.length > 0 && lines[lines.length - 1].length === 0) {
    lines.pop();
  }
  
  // Filter out empty lines (but keep lines with spaces)
  lines = lines.filter(line => line.length > 0);
  
  const annotations: Array<{ span: { start: number; end: number } }> = [];
  let cleanedContent = '';
  let currentPosition = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLength = line.length;
    
    // Each line with content gets a span annotation
    annotations.push({
      span: {
        start: currentPosition,
        end: currentPosition + lineLength
      }
    });
    
    // Add line text to cleaned content (no newline)
    cleanedContent += line;
    
    // Advance position by line length
    currentPosition += lineLength;
  }
  
  return { annotations, cleanedContent };
}