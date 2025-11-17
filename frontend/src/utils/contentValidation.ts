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

