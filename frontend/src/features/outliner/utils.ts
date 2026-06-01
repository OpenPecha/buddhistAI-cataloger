export const normalizeSearchQuery = (query: string | null | undefined): string =>
  (query ?? '')
    .normalize('NFC')
    .trim()
    .replace(/(?:\u0F0B\u0F0D|\u0F0D\u0F0D|\u0F0D)+$/u, '')  
    .trim();

// Find all occurrences of a search string in text (case-insensitive)
export const findAllOccurrences = (
  text: string,
  searchText: string
): Array<{ start: number; end: number }> => {
  const normalized = normalizeSearchQuery(searchText);
  if (!normalized) {
    return [];
  }

  const occurrences: Array<{ start: number; end: number }> = [];
  const searchLower = normalized.toLowerCase();
  const textLower = text.toLowerCase();
  let startIndex = 0;

  while (true) {
    const index = textLower.indexOf(searchLower, startIndex);
    if (index === -1) {
      break;
    }
    occurrences.push({
      start: index,
      end: index + normalized.length,
    });
    startIndex = index + 1;
  }

  return occurrences;
};







