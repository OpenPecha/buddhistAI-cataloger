/**
 * Calculate line-by-line annotations for text content with newline-free output
 * 
 * Each line (including empty lines) gets a span annotation with [start, end) indices.
 * Empty lines get zero-length spans like {start: N, end: N}
 * Non-empty lines get spans pointing to their text in the cleaned content (no newlines)
 * 
 * @param content - The full text content with newlines from the editor
 * @returns Object with annotations array and cleaned content (no newlines)
 */
export function calculateAnnotations(content: string): {
  annotations: Array<{ span: { start: number; end: number } }>;
  cleanedContent: string;
} {
  // Handle empty content
  if (!content) {
    return { annotations: [], cleanedContent: '' };
  }

  // Split by newline to get all lines (including empty ones)
  const lines = content.split('\n');
  const annotations: Array<{ span: { start: number; end: number } }> = [];
  let cleanedContent = '';
  let currentPosition = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLength = line.length;
    
    if (lineLength === 0) {
      // Empty line: zero-length span at current position
      annotations.push({
        span: {
          start: currentPosition,
          end: currentPosition
        }
      });
      // Position doesn't advance for empty lines
    } else {
      // Non-empty line: span covers the text in cleaned content
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
  }
  
  return { annotations, cleanedContent };
}

/**
 * Example usage:
 * 
 * Input Content (from editor with newlines):
 * "\nAlpha\n\nBravo charlie\n\n\nDelta"
 * 
 * Lines after split:
 * ["", "Alpha", "", "Bravo charlie", "", "", "Delta"]
 * 
 * Output:
 * {
 *   annotations: [
 *     { span: { start: 0,  end: 0 } },   // "" (leading empty line)
 *     { span: { start: 0,  end: 5 } },   // "Alpha"
 *     { span: { start: 5,  end: 5 } },   // "" (empty line)
 *     { span: { start: 5,  end: 19 } },  // "Bravo charlie"
 *     { span: { start: 19, end: 19 } },  // "" (empty line)
 *     { span: { start: 19, end: 19 } },  // "" (empty line)
 *     { span: { start: 19, end: 24 } }   // "Delta"
 *   ],
 *   cleanedContent: "AlphaBravo charlieDelta"  // No newlines
 * }
 */

