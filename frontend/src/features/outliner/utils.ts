export const findAllOccurrences = (
  text: string,
  searchText: string
): Array<{ start: number; end: number }> => {
  if (!searchText || searchText.trim().length === 0) return []
  const occurrences: Array<{ start: number; end: number }> = []
  const searchLower = searchText.toLowerCase()
  const textLower = text.toLowerCase()
  let startIndex = 0
  while (true) {
    const index = textLower.indexOf(searchLower, startIndex)
    if (index === -1) break
    occurrences.push({ start: index, end: index + searchText.length })
    startIndex = index + 1
  }
  return occurrences
}

export const escapeHtml = (text: string): string => {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

interface TransitionPoint {
  position: number
  type: 'title' | 'author'
  isStart: boolean
}

interface TextPart {
  text: string
  start: number
  end: number
  markers: ('title' | 'author')[]
}

export const renderTextWithMarkers = (
  text: string,
  title?: string,
  author?: string
): string => {
  if (!title && !author) return text
  const titleOccurrences = title ? findAllOccurrences(text, title) : []
  const authorOccurrences = author ? findAllOccurrences(text, author) : []
  const markers: Array<{ start: number; end: number; type: 'title' | 'author' }> = []
  titleOccurrences.forEach((occ) => markers.push({ ...occ, type: 'title' }))
  authorOccurrences.forEach((occ) => markers.push({ ...occ, type: 'author' }))
  if (markers.length === 0) return text

  const transitions: TransitionPoint[] = []
  markers.forEach((marker) => {
    transitions.push({ position: marker.start, type: marker.type, isStart: true })
    transitions.push({ position: marker.end, type: marker.type, isStart: false })
  })
  transitions.sort((a, b) => a.position - b.position)

  let currentPos = 0
  const activeMarkers = new Set<'title' | 'author'>()
  const parts: TextPart[] = []
  let i = 0
  while (i < transitions.length) {
    const position = transitions[i].position
    if (position > currentPos) {
      parts.push({
        text: text.substring(currentPos, position),
        start: currentPos,
        end: position,
        markers: Array.from(activeMarkers),
      })
    }
    while (i < transitions.length && transitions[i].position === position) {
      const transition = transitions[i]
      if (transition.isStart) activeMarkers.add(transition.type)
      else activeMarkers.delete(transition.type)
      i++
    }
    currentPos = position
  }
  if (currentPos < text.length) {
    parts.push({
      text: text.substring(currentPos),
      start: currentPos,
      end: text.length,
      markers: [],
    })
  }

  let html = ''
  for (const part of parts) {
    if (part.markers.length === 0) {
      html += escapeHtml(part.text)
    } else {
      let bgClass = ''
      let textClass = ''
      let borderClass = ''
      if (part.markers.includes('title') && part.markers.includes('author')) {
        bgClass = 'bg-gradient-to-r from-yellow-100 to-purple-100'
        textClass = 'text-gray-900'
        borderClass = 'border border-yellow-300 border-dashed'
      } else if (part.markers.includes('title')) {
        bgClass = 'bg-yellow-100'
        textClass = 'text-yellow-900'
        borderClass = 'border border-yellow-300'
      } else if (part.markers.includes('author')) {
        bgClass = 'bg-purple-100'
        textClass = 'text-purple-900'
        borderClass = 'border border-purple-300'
      }
      const markerClasses = part.markers.map((m) => `marker-${m}`).join(' ')
      html += `<span class="text-marker ${markerClasses} ${bgClass} ${textClass} ${borderClass} px-1 rounded" data-marker-type="${part.markers.join(',')}" data-span-start="${part.start}" data-span-end="${part.end}">${escapeHtml(part.text)}</span>`
    }
  }
  return html
}
