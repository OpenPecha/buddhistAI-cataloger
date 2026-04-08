
// Find all occurrences of a search string in text (case-insensitive)
export const findAllOccurrences = (
  text: string,
  searchText: string
): Array<{ start: number; end: number }> => {
  if (!searchText || searchText.trim().length === 0) {
    return [];
  }

  const occurrences: Array<{ start: number; end: number }> = [];
  const searchLower = searchText.toLowerCase();
  const textLower = text.toLowerCase();
  let startIndex = 0;

  while (true) {
    const index = textLower.indexOf(searchLower, startIndex);
    if (index === -1) {
      break;
    }
    occurrences.push({
      start: index,
      end: index + searchText.length,
    });
    startIndex = index + 1;
  }

  return occurrences;
};







