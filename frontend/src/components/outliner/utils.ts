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

// Escape HTML to prevent XSS
export const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

type MarkerTransition = {
  position: number;
  kind: 'marker';
  type: 'title' | 'author';
  isStart: boolean;
};

type SearchTransition = {
  position: number;
  kind: 'search';
  matchIndex: number;
  isStart: boolean;
};

type UnifiedTransition = MarkerTransition | SearchTransition;

function sortTransitions(a: UnifiedTransition, b: UnifiedTransition): number {
  if (a.position !== b.position) return a.position - b.position;
  // End transitions before start at the same index (e.g. adjacent search matches)
  if (a.isStart !== b.isStart) return a.isStart ? 1 : -1;
  return 0;
}

function wrapMarkerSpan(
  markers: ('title' | 'author')[],
  innerHtml: string,
  part: { start: number; end: number }
): string {
  if (markers.length === 0) return innerHtml;

  let bgClass = '';
  let textClass = '';
  let borderClass = '';

  if (markers.includes('title') && markers.includes('author')) {
    bgClass = 'bg-gradient-to-r from-yellow-100 to-purple-100';
    textClass = 'text-gray-900';
    borderClass = 'border border-yellow-300 border-dashed';
  } else if (markers.includes('title')) {
    bgClass = 'bg-yellow-100';
    textClass = 'text-yellow-900';
    borderClass = 'border border-yellow-300';
  } else if (markers.includes('author')) {
    bgClass = 'bg-purple-100';
    textClass = 'text-purple-900';
    borderClass = 'border border-purple-300';
  }

  const markerClasses = markers.map((m) => `marker-${m}`).join(' ');
  return `<span class="text-marker ${markerClasses} ${bgClass} ${textClass} ${borderClass} px-1 rounded" data-marker-type="${markers.join(',')}" data-span-start="${part.start}" data-span-end="${part.end}">${innerHtml}</span>`;
}

function wrapSearchSpan(matchIndex: number | null, innerHtml: string): string {
  if (matchIndex === null) return innerHtml;
  return `<span class="segment-search-match bg-amber-200/80 rounded-sm">${innerHtml}</span>`;
}

// Helper function to render text with title/author markers and optional in-segment search highlights
export const renderTextWithMarkers = (
  text: string,
  title?: string,
  author?: string,
  searchQuery?: string
): string => {
  const trimmedSearch = searchQuery?.trim() ?? '';
  const hasSearch = trimmedSearch.length > 0;

  if (!title && !author && !hasSearch) {
    return text;
  }

  const titleOccurrences = title ? findAllOccurrences(text, title) : [];
  const authorOccurrences = author ? findAllOccurrences(text, author) : [];
  const searchOccurrences = hasSearch ? findAllOccurrences(text, trimmedSearch) : [];

  const markers: Array<{ start: number; end: number; type: 'title' | 'author' }> = [];
  titleOccurrences.forEach((occ) => {
    markers.push({ ...occ, type: 'title' });
  });
  authorOccurrences.forEach((occ) => {
    markers.push({ ...occ, type: 'author' });
  });

  if (markers.length === 0 && searchOccurrences.length === 0) {
    return text;
  }

  const transitions: UnifiedTransition[] = [];
  markers.forEach((marker) => {
    transitions.push({
      position: marker.start,
      kind: 'marker',
      type: marker.type,
      isStart: true,
    });
    transitions.push({
      position: marker.end,
      kind: 'marker',
      type: marker.type,
      isStart: false,
    });
  });
  searchOccurrences.forEach((occ, matchIndex) => {
    transitions.push({
      position: occ.start,
      kind: 'search',
      matchIndex,
      isStart: true,
    });
    transitions.push({
      position: occ.end,
      kind: 'search',
      matchIndex,
      isStart: false,
    });
  });

  transitions.sort(sortTransitions);

  let currentPos = 0;
  const activeMarkers = new Set<'title' | 'author'>();
  let activeSearchMatch: number | null = null;

  interface TextPart {
    text: string;
    start: number;
    end: number;
    markers: ('title' | 'author')[];
    searchMatchIndex: number | null;
  }

  const parts: TextPart[] = [];

  let i = 0;
  while (i < transitions.length) {
    const position = transitions[i].position;

    if (position > currentPos) {
      parts.push({
        text: text.substring(currentPos, position),
        start: currentPos,
        end: position,
        markers: Array.from(activeMarkers),
        searchMatchIndex: activeSearchMatch,
      });
    }

    while (i < transitions.length && transitions[i].position === position) {
      const t = transitions[i];
      if (t.kind === 'marker') {
        if (t.isStart) {
          activeMarkers.add(t.type);
        } else {
          activeMarkers.delete(t.type);
        }
      } else if (t.isStart) {
        activeSearchMatch = t.matchIndex;
      } else if (activeSearchMatch === t.matchIndex) {
        activeSearchMatch = null;
      }
      i++;
    }

    currentPos = position;
  }

  if (currentPos < text.length) {
    parts.push({
      text: text.substring(currentPos),
      start: currentPos,
      end: text.length,
      markers: Array.from(activeMarkers),
      searchMatchIndex: activeSearchMatch,
    });
  }

  let html = '';
  for (const part of parts) {
    let inner = escapeHtml(part.text);
    inner = wrapSearchSpan(part.searchMatchIndex, inner);
    inner = wrapMarkerSpan(part.markers, inner, { start: part.start, end: part.end });
    html += inner;
  }

  return html;
};
