import React, { useState, useRef, useCallback, useEffect } from 'react';
import FileUploadZone from './textCreation/FileUploadZone';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useBdrcSearch } from '@/hooks/useBdrcSearch';
import { Loader2, Scissors, Sparkles, X, Square } from 'lucide-react';
import { API_URL } from '@/config/api';

interface TextSegment {
  id: string;
  text: string;
  title?: string;
  author?: string;
  title_bdrc_id?: string;
  author_bdrc_id?: string;
  parentSegmentId?: string;
}

interface BubbleMenuProps {
  position: { x: number; y: number };
  onSelect: (field: 'title' | 'author') => void;
  onClose: () => void;
}

interface SplitMenuProps {
  position: { x: number; y: number };
  onSplit: () => void;
  onClose: () => void;
}


const BubbleMenu: React.FC<BubbleMenuProps> = ({ position, onSelect, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-2 min-w-[150px]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div className="text-xs text-gray-500 mb-2 px-2 py-1 border-b border-gray-200">
        Use selected text as:
      </div>
      <button
        onClick={() => onSelect('title')}
        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded-md transition-colors"
      >
        📄 Title
      </button>
      <button
        onClick={() => onSelect('author')}
        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded-md transition-colors"
      >
        👤 Author
      </button>
    </div>
  );
};

// Helper function to render text with markers
// Find all occurrences of a search string in text (case-insensitive)
const findAllOccurrences = (text: string, searchText: string): Array<{ start: number; end: number }> => {
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

const renderTextWithMarkers = (text: string, title?: string, author?: string): string => {
  if (!title && !author) {
    return text;
  }

  // Find all occurrences of title and author in the text
  const titleOccurrences = title ? findAllOccurrences(text, title) : [];
  const authorOccurrences = author ? findAllOccurrences(text, author) : [];
  
  // Combine all markers
  const markers: Array<{ start: number; end: number; type: 'title' | 'author' }> = [];
  titleOccurrences.forEach(occ => {
    markers.push({ ...occ, type: 'title' });
  });
  authorOccurrences.forEach(occ => {
    markers.push({ ...occ, type: 'author' });
  });

  if (markers.length === 0) {
    return text;
  }

  // Create a list of all transition points (start and end of each marker)
  interface TransitionPoint {
    position: number;
    type: 'title' | 'author';
    isStart: boolean;
  }
  
  const transitions: TransitionPoint[] = [];
  markers.forEach(marker => {
    transitions.push({ position: marker.start, type: marker.type, isStart: true });
    transitions.push({ position: marker.end, type: marker.type, isStart: false });
  });
  
  // Sort transitions by position
  transitions.sort((a, b) => a.position - b.position);
  
  // Process transitions to build parts
  // Group transitions at the same position
  let currentPos = 0;
  const activeMarkers = new Set<'title' | 'author'>();
  
  interface TextPart {
    text: string;
    start: number;
    end: number;
    markers: ('title' | 'author')[];
  }
  
  const parts: TextPart[] = [];
  
  let i = 0;
  while (i < transitions.length) {
    const position = transitions[i].position;
    
    // Add text before this position if there's a gap
    if (position > currentPos) {
      parts.push({
        text: text.substring(currentPos, position),
        start: currentPos,
        end: position,
        markers: Array.from(activeMarkers),
      });
    }
    
    // Process all transitions at this position
    while (i < transitions.length && transitions[i].position === position) {
      const transition = transitions[i];
      if (transition.isStart) {
        activeMarkers.add(transition.type);
      } else {
        activeMarkers.delete(transition.type);
      }
      i++;
    }
    
    currentPos = position;
  }
  
  // Add remaining text
  if (currentPos < text.length) {
    parts.push({
      text: text.substring(currentPos),
      start: currentPos,
      end: text.length,
      markers: [],
    });
  }

  // Build HTML string
  let html = '';
  for (const part of parts) {
    if (part.markers.length === 0) {
      html += escapeHtml(part.text);
    } else {
      // Determine styling based on marker types
      let bgClass = '';
      let textClass = '';
      let borderClass = '';
      
      if (part.markers.includes('title') && part.markers.includes('author')) {
        // Both markers overlap - use combined styling
        bgClass = 'bg-gradient-to-r from-yellow-100 to-purple-100';
        textClass = 'text-gray-900';
        borderClass = 'border border-yellow-300 border-dashed';
      } else if (part.markers.includes('title')) {
        bgClass = 'bg-yellow-100';
        textClass = 'text-yellow-900';
        borderClass = 'border border-yellow-300';
      } else if (part.markers.includes('author')) {
        bgClass = 'bg-purple-100';
        textClass = 'text-purple-900';
        borderClass = 'border border-purple-300';
      }
      
      const markerClasses = part.markers.map(m => `marker-${m}`).join(' ');
      html += `<span class="text-marker ${markerClasses} ${bgClass} ${textClass} ${borderClass} px-1 rounded" data-marker-type="${part.markers.join(',')}" data-span-start="${part.start}" data-span-end="${part.end}">${escapeHtml(part.text)}</span>`;
    }
  }
  
  return html;
};

// Escape HTML to prevent XSS
const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// Segment text content component with contentEditable
interface SegmentTextContentProps {
  segmentId: string;
  text: string;
  title?: string;
  author?: string;
  onCursorChange: (segmentId: string, element: HTMLDivElement) => void;
  onActivate: () => void;
  onInput: (e: React.FormEvent<HTMLDivElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}

const SegmentTextContent = React.forwardRef<HTMLDivElement, SegmentTextContentProps>(
  ({ segmentId, text, title, author, onCursorChange, onActivate, onInput, onKeyDown }, ref) => {
    const contentRef = useRef<HTMLDivElement>(null);
    
    // Combine refs
    useEffect(() => {
      if (typeof ref === 'function') {
        ref(contentRef.current);
      } else if (ref) {
        ref.current = contentRef.current;
      }
    }, [ref]);

    // Set HTML content when it changes
    useEffect(() => {
      if (contentRef.current) {
        const selection = globalThis.getSelection();
        const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
        const wasFocused = document.activeElement === contentRef.current;
        
        // Save cursor position
        let cursorOffset: number | null = null;
        if (wasFocused && range && contentRef.current.contains(range.commonAncestorContainer)) {
          const preRange = range.cloneRange();
          preRange.selectNodeContents(contentRef.current);
          preRange.setEnd(range.endContainer, range.endOffset);
          cursorOffset = preRange.toString().length;
        }

        // Render text with markers
        const html = renderTextWithMarkers(text, title, author);
        contentRef.current.innerHTML = html;

        // Restore cursor position if it was focused
        if (wasFocused && cursorOffset !== null) {
          const textContent = contentRef.current.textContent || '';
          const clampedOffset = Math.min(cursorOffset, textContent.length);
          
          // Find the text node and set cursor position
          const walker = document.createTreeWalker(
            contentRef.current,
            NodeFilter.SHOW_TEXT,
            null
          );
          
          let currentPos = 0;
          let targetNode: Node | null = null;
          let targetOffset = 0;
          
          let node: Node | null = walker.nextNode();
          while (node !== null) {
            const nodeLength = node.textContent?.length || 0;
            if (currentPos + nodeLength >= clampedOffset) {
              targetNode = node;
              targetOffset = clampedOffset - currentPos;
              break;
            }
            currentPos += nodeLength;
            node = walker.nextNode();
          }
          
          if (targetNode) {
            const newRange = document.createRange();
            newRange.setStart(targetNode, targetOffset);
            newRange.setEnd(targetNode, targetOffset);
            selection?.removeAllRanges();
            selection?.addRange(newRange);
          }
        }
      }
    }, [text, title, author]);

    return (
      <div
        ref={contentRef}
        data-segment-id={segmentId}
        className="segment-text-content text-gray-900 whitespace-pre-wrap wrap-break-word select-text relative outline-none"
        contentEditable
        suppressContentEditableWarning
        onInput={onInput}
        onKeyDown={onKeyDown}
        onSelect={() => {
          if (contentRef.current) {
            onCursorChange(segmentId, contentRef.current);
          }
        }}
        onClick={() => {
          if (contentRef.current) {
            onCursorChange(segmentId, contentRef.current);
            onActivate();
          }
        }}
      />
    );
  }
);

SegmentTextContent.displayName = 'SegmentTextContent';

const SplitMenu: React.FC<SplitMenuProps> = ({ position, onSplit, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="split-menu absolute z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-2 min-w-[180px]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <button
        onClick={() => {
          onSplit();
          onClose();
        }}
        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded-md transition-colors flex items-center gap-2"
      >
        <Scissors className="w-4 h-4" />
        Split Here
      </button>
    </div>
  );
};

function MockLongCataloger() {
  const [textContent, setTextContent] = useState<string>('');
  const [segments, setSegments] = useState<TextSegment[]>([]);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  // Generate a random ID for the last segment of previous data (mock)
  const [previousDataLastSegmentId] = useState<string>(() => `prev-segment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const [bubbleMenuState, setBubbleMenuState] = useState<{ 
    segmentId: string; 
    position: { x: number; y: number }; 
    selectedText: string;
    selectionRange?: Range;
  } | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{ segmentId: string; offset: number; menuPosition?: { x: number; y: number } } | null>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const titleInputRef = useRef<HTMLInputElement>(null);
  const authorInputRef = useRef<HTMLInputElement>(null);
  const aiAbortControllerRef = useRef<AbortController | null>(null);

  // Track if change is coming from dropdown selection to prevent re-triggering search
  const isSelectingFromDropdown = useRef({ title: false, author: false });

  // BDRC search for title - use separate state for search query
  const [titleSearch, setTitleSearch] = useState('');
  const [titleSearchQuery, setTitleSearchQuery] = useState('');
  const { results: titleResults, isLoading: titleLoading } = useBdrcSearch(
    titleSearchQuery,
    'Instance',
    1000,
    ()=>{
        titleInputRef.current?.focus();
    }
  );
  const [showTitleDropdown, setShowTitleDropdown] = useState(false);

  // BDRC search for author - use separate state for search query
  const [authorSearch, setAuthorSearch] = useState('');
  const [authorSearchQuery, setAuthorSearchQuery] = useState('');
  const { results: authorResults, isLoading: authorLoading } = useBdrcSearch(
    authorSearchQuery,
    'Person',
    1000,
    ()=>{
        authorInputRef.current?.focus();
    }
  );
  const [showAuthorDropdown, setShowAuthorDropdown] = useState(false);

  // AI suggestions state
  const [aiSuggestions, setAiSuggestions] = useState<{
    title: string | null;
    suggested_title: string | null;
    author: string | null;
    suggested_author: string | null;
  } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Focus title input when search results are ready
  useEffect(() => {
    if (!titleLoading && titleSearch.trim().length > 0 && titleResults.length > 0 && showTitleDropdown) {
      titleInputRef.current?.focus();
    }
  }, [titleLoading, titleResults.length, titleSearch, showTitleDropdown]);

  // Focus author input when search results are ready
  useEffect(() => {
    if (!authorLoading && authorSearch.trim().length > 0 && authorResults.length > 0 && showAuthorDropdown) {
      authorInputRef.current?.focus();
    }
  }, [authorLoading, authorResults.length, authorSearch, showAuthorDropdown]);

  // Focus title or author input when AI suggestions are loaded
  useEffect(() => {
    if (!aiLoading && aiSuggestions) {
      // Use setTimeout to ensure DOM has updated with the new values
      setTimeout(() => {
        // Focus title field if it has a suggestion, otherwise focus author field
        if (aiSuggestions.title || aiSuggestions.suggested_title) {
          titleInputRef.current?.focus();
        } else if (aiSuggestions.author || aiSuggestions.suggested_author) {
          authorInputRef.current?.focus();
        }
      }, 100);
    }
  }, [aiLoading, aiSuggestions]);

  // Handle file upload
  const handleFileUpload = useCallback((content: string) => {
    setTextContent(content);
    // Split content by newlines to create segments
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    const newSegments: TextSegment[] = lines.map((line, index) => ({
      id: `segment-${index}`,
      text: line.trim(),
    }));
    setSegments(newSegments);
    // Set first segment as active
    if (newSegments.length > 0) {
      setActiveSegmentId(newSegments[0].id);
    }
  }, []);

  // Handle text selection in workspace
  const handleTextSelection = useCallback(() => {
    const selection = globalThis.getSelection();
    if (!selection) {
      setBubbleMenuState(null);
      return;
    }

    const selectedText = selection.toString().trim();
    const hasTextSelection = selectedText.length > 0;

    // Find which segment contains the selection
    let targetSegmentId: string | null = null;
    let targetSegmentElement: Element | null = null;
    
    for (const segment of segments) {
      const segmentElement = document.querySelector(`[data-segment-id="${segment.id}"]`);
      if (segmentElement) {
        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        if (range && segmentElement.contains(range.commonAncestorContainer)) {
          targetSegmentId = segment.id;
          targetSegmentElement = segmentElement;
          break;
        }
      }
    }

    if (!targetSegmentId || !targetSegmentElement) {
      setBubbleMenuState(null);
      setCursorPosition(null);
      return;
    }

    const range = selection.getRangeAt(0);

    // If text is selected, show bubble menu (title/author) and hide split menu
    if (hasTextSelection) {
      // Get selection range
      const rect = range.getBoundingClientRect();
      const segmentContainer = targetSegmentElement.closest('[data-segment-container-id]') as HTMLElement;
      
      if (segmentContainer) {
        const segmentRect = segmentContainer.getBoundingClientRect();
        const menuWidth = 150; // Bubble menu width
        
        // Position menu below selection, relative to segment container (same as split menu)
        const menuPosition = {
          x: rect.left - segmentRect.left - menuWidth / 2 + rect.width / 2,
          y: rect.bottom - segmentRect.top + 8, // 8px gap below selection
        };
        
        // Ensure menu stays within segment bounds (with padding)
        const padding = 8;
        if (menuPosition.x < padding) {
          menuPosition.x = padding;
        }
        if (menuPosition.x + menuWidth > segmentRect.width - padding) {
          menuPosition.x = segmentRect.width - menuWidth - padding;
        }
        
        setBubbleMenuState({
          segmentId: targetSegmentId,
          position: menuPosition,
          selectedText: selectedText,
          selectionRange: range.cloneRange(),
        });
        setCursorPosition(null); // Hide split menu
      }
    } else {
      // No text selected, hide bubble menu
      setBubbleMenuState(null);
    }
  }, [segments]);

  // Handle bubble menu selection
  const handleBubbleMenuSelect = useCallback((field: 'title' | 'author', segmentId: string, text: string) => {
    if (!segmentId || !text) return;

    // Just store the title/author text, no span calculation needed
    setSegments(prev => prev.map(seg => {
      if (seg.id === segmentId) {
        return {
          ...seg,
          [field]: text,
        };
      }
      return seg;
    }));

    if (field === 'author') {
      setAuthorSearch(text);
      setAuthorSearchQuery(text);
    } else if (field === 'title') {
      setTitleSearch(text);
      setTitleSearchQuery(text);
    }

    setBubbleMenuState(null);
  }, []);

  // Handle segment click
  const handleSegmentClick = useCallback((segmentId: string, event?: React.MouseEvent) => {
    // If clicking on the segment container (not text), just activate it
    if (!event || (event.target as HTMLElement).closest('.segment-text-content')) {
      setActiveSegmentId(segmentId);
      setBubbleMenuState(null);
      return;
    }
    setActiveSegmentId(segmentId);
    setBubbleMenuState(null);
    setCursorPosition(null);
  }, []);

  // Handle cursor position change in contentEditable
  const handleCursorChange = useCallback((segmentId: string, element: HTMLDivElement) => {
    const selection = globalThis.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    
    // Check if selection is within this segment
    if (!element.contains(range.commonAncestorContainer)) return;

    // Check if there's text selected - if yes, don't show split menu
    const selectedText = selection.toString().trim();
    if (selectedText.length > 0) {
      // Text is selected, don't show split menu (bubble menu will be shown by handleTextSelection)
      setCursorPosition(null);
      return;
    }

    // Calculate character offset
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    const offset = preCaretRange.toString().length;

    // Get cursor position relative to the segment container
    const cursorRect = range.getBoundingClientRect();
    const segmentContainer = element.closest('[data-segment-container-id]') as HTMLElement;
    
    if (!segmentContainer) return;

    const segmentRect = segmentContainer.getBoundingClientRect();
    const menuWidth = 180;
    
    // Position menu below cursor, relative to segment container
    const menuPosition = {
      x: cursorRect.left - segmentRect.left - menuWidth / 2 + cursorRect.width / 2,
      y: cursorRect.bottom - segmentRect.top + 8, // 8px gap below cursor
    };
    
    // Ensure menu stays within segment bounds (with padding)
    const padding = 8;
    if (menuPosition.x < padding) {
      menuPosition.x = padding;
    }
    if (menuPosition.x + menuWidth > segmentRect.width - padding) {
      menuPosition.x = segmentRect.width - menuWidth - padding;
    }
    
    // Show split menu and hide bubble menu when no text is selected
    setCursorPosition({ segmentId, offset, menuPosition });
    setBubbleMenuState(null);
  }, []);

  // Handle contentEditable input prevention
  const handleContentEditableInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    e.preventDefault();
    // Restore the original content
    const target = e.currentTarget;
    const segmentId = target.getAttribute('data-segment-id');
    if (segmentId) {
      const segment = segments.find(seg => seg.id === segmentId);
      if (segment) {
        // Use setTimeout to restore after browser tries to update
        setTimeout(() => {
          target.textContent = segment.text;
        }, 0);
      }
    }
  }, [segments]);

  // Handle contentEditable keydown to prevent content changes
  const handleContentEditableKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Allow navigation keys
    const allowedKeys = [
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End', 'PageUp', 'PageDown',
      'Tab', 'Escape'
    ];
    
    // Allow Ctrl/Cmd combinations for navigation
    if (e.ctrlKey || e.metaKey) {
      if (['a', 'c', 'x', 'v'].includes(e.key.toLowerCase())) {
        // Allow select all, copy, cut, paste
        return;
      }
    }
    
    // Block all other keys that would modify content
    if (!allowedKeys.includes(e.key) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
    }
  }, []);


  // Handle attach parent button click for first segment
  const handleAttachParent = useCallback(() => {
    if (segments.length === 0) return;
    
    const firstSegmentId = segments[0].id;
    
    // Toggle attachment: if already attached, remove it; otherwise attach
    setSegments(prev => prev.map(seg => {
      if (seg.id === firstSegmentId) {
        return {
          ...seg,
          parentSegmentId: seg.parentSegmentId ? undefined : previousDataLastSegmentId,
        };
      }
      return seg;
    }));
  }, [segments, previousDataLastSegmentId]);

  // Split segment at cursor position
  const handleSplitSegment = useCallback(() => {
    if (!cursorPosition || !activeSegmentId) return;

    const segment = segments.find(seg => seg.id === cursorPosition.segmentId);
    if (!segment) return;

    const textBefore = segment.text.substring(0, cursorPosition.offset).trim();
    const textAfter = segment.text.substring(cursorPosition.offset).trim();

    // Don't split if either part would be empty
    if (!textBefore || !textAfter) {
      return;
    }

    // Find the index of the segment to split
    const segmentIndex = segments.findIndex(seg => seg.id === cursorPosition.segmentId);
    if (segmentIndex === -1) return;

    // Create new segments
    const newSegments = [...segments];
    const firstSegment: TextSegment = {
      id: segment.id,
      text: textBefore,
      title: segment.title,
      author: segment.author,
      title_bdrc_id: segment.title_bdrc_id,
      author_bdrc_id: segment.author_bdrc_id,
    };

    // Generate new ID for second segment
    const newSegmentId = `segment-${Date.now()}`;
    const secondSegment: TextSegment = {
      id: newSegmentId,
      text: textAfter,
    };

    // Replace the original segment with the first part, insert the second part after it
    newSegments[segmentIndex] = firstSegment;
    newSegments.splice(segmentIndex + 1, 0, secondSegment);

    setSegments(newSegments);
    setActiveSegmentId(newSegmentId);
    setCursorPosition(null);
  }, [cursorPosition, segments, activeSegmentId]);

  // Update segment annotation
  const updateSegmentAnnotation = useCallback((
    segmentId: string,
    field: 'title' | 'author' | 'title_bdrc_id' | 'author_bdrc_id',
    value: string
  ) => {
    setSegments(prev => prev.map(seg => {
      if (seg.id === segmentId) {
        return {
          ...seg,
          [field]: value,
        };
      }
      return seg;
    }));
  }, []);

  // Get active segment
  const activeSegment = segments.find(seg => seg.id === activeSegmentId);

  // Sync titleSearch and authorSearch with active segment when it changes
  useEffect(() => {
    if (activeSegment) {
      setTitleSearch(activeSegment.title || '');
      setAuthorSearch(activeSegment.author || '');
      // Update search queries when segment changes
      setTitleSearchQuery(activeSegment.title || '');
      setAuthorSearchQuery(activeSegment.author || '');
    } else {
      setTitleSearch('');
      setAuthorSearch('');
      setTitleSearchQuery('');
      setAuthorSearchQuery('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSegmentId]);

  // Handle title selection from BDRC search
  const handleTitleSelect = useCallback((title: { workId?: string; instanceId?: string; title?: string }) => {
    if (!activeSegmentId || !title.workId) return;
    
    // Mark that we're selecting from dropdown to prevent search re-trigger
    isSelectingFromDropdown.current.title = true;
    
    // Only update the BDRC ID, not the title text itself
    updateSegmentAnnotation(activeSegmentId, 'title_bdrc_id', title.workId);
    setShowTitleDropdown(false);
    
    // Reset flag after a short delay
    setTimeout(() => {
      isSelectingFromDropdown.current.title = false;
    }, 100);
  }, [activeSegmentId, updateSegmentAnnotation]);

  // Handle author selection from BDRC search
  const handleAuthorSelect = useCallback((author: { bdrc_id?: string; name?: string }) => {
    if (!activeSegmentId || !author.bdrc_id) return;
    
    // Mark that we're selecting from dropdown to prevent search re-trigger
    isSelectingFromDropdown.current.author = true;
    
    // Only update the BDRC ID, not the author text itself
    updateSegmentAnnotation(activeSegmentId, 'author_bdrc_id', author.bdrc_id);
    setShowAuthorDropdown(false);
    
    // Reset flag after a short delay
    setTimeout(() => {
      isSelectingFromDropdown.current.author = false;
    }, 100);
  }, [activeSegmentId, updateSegmentAnnotation]);

  // Clear AI suggestions when active segment changes (but don't auto-fetch)
  useEffect(() => {
    // Abort any ongoing AI request when segment changes
    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
      aiAbortControllerRef.current = null;
    }
    setAiLoading(false);
    setAiSuggestions(null);
  }, [activeSegmentId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (aiAbortControllerRef.current) {
        aiAbortControllerRef.current.abort();
      }
    };
  }, []);

  // AI auto-detect title and author from text
  const handleAIDetect = useCallback(async () => {
    if (!activeSegmentId) return;
    
    const segment = segments.find(seg => seg.id === activeSegmentId);
    if (!segment || !segment.text) return;

    const text = segment.text.trim();
    if (!text) return;

    // Abort any existing request
    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    const abortController = new AbortController();
    aiAbortControllerRef.current = abortController;

    setAiLoading(true);
    try {
      const response = await fetch(`${API_URL}/ai/generate-title-author`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'accept': 'application/json',
        },
        body: JSON.stringify({ content: text }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch AI suggestions');
      }

      const data = await response.json();
      setAiSuggestions(data);

      // Update segment with detected/extracted values (not suggestions)
      if (data.title) {
        updateSegmentAnnotation(activeSegmentId, 'title', data.title);
        setTitleSearch(data.title);
        setTitleSearchQuery(data.title);
        setShowTitleDropdown(data.title.length > 0);
      } else if (data.suggested_title) {
        updateSegmentAnnotation(activeSegmentId, 'title', data.suggested_title);
        setTitleSearch(data.suggested_title);
        setTitleSearchQuery(data.suggested_title);
        setShowTitleDropdown(data.suggested_title.length > 0);
      }

      if (data.author) {
        updateSegmentAnnotation(activeSegmentId, 'author', data.author);
        setAuthorSearch(data.author);
        setAuthorSearchQuery(data.author);
        setShowAuthorDropdown(data.author.length > 0);
      } else if (data.suggested_author) {
        updateSegmentAnnotation(activeSegmentId, 'author', data.suggested_author);
        setAuthorSearch(data.suggested_author);
        setAuthorSearchQuery(data.suggested_author);
        setShowAuthorDropdown(data.suggested_author.length > 0);
      }
    } catch (error) {
      // Don't log error if it was aborted
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error fetching AI suggestions:', error);
      }
    } finally {
      // Only reset loading if this request wasn't aborted
      if (!abortController.signal.aborted) {
        setAiLoading(false);
        aiAbortControllerRef.current = null;
      }
    }
  }, [activeSegmentId, segments, updateSegmentAnnotation]);

  // Stop AI suggestion request
  const handleAIStop = useCallback(() => {
    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
      aiAbortControllerRef.current = null;
      setAiLoading(false);
      setAiSuggestions(null);
    }
  }, []);

  // Save annotations with span information
  const handleSave = useCallback(() => {
    if (!textContent || segments.length === 0) {
      return;
    }

    // Calculate span addresses for each segment
    // Find each segment's text position in the original textContent
    let searchOffset = 0;
    const annotations: Array<{
      segmentId: string;
      segmentIndex: number;
      span: {
        start: number;
        end: number;
      };
      text: string;
      metadata: {
        title?: string;
        author?: string;
        title_bdrc_id?: string;
        author_bdrc_id?: string;
      };
    }> = [];

    segments.forEach((segment, index) => {
      const segmentText = segment.text;
      
      // Try to find the segment text in the original textContent
      // Start searching from the previous segment's end position
      const start = textContent.indexOf(segmentText, searchOffset);
      let end = start + segmentText.length;
      
      // If not found, calculate based on cumulative length
      if (start === -1) {
        // Fallback: calculate based on previous segments
        const previousEnd = annotations.length > 0 
          ? annotations[annotations.length - 1].span.end 
          : 0;
        // Try to find a reasonable position by searching from beginning
        const fallbackStart = textContent.indexOf(segmentText, 0);
        if (fallbackStart !== -1) {
          end = fallbackStart + segmentText.length;
          searchOffset = end;
        } else {
          // Last resort: use cumulative approximation
          end = previousEnd + segmentText.length + 1; // +1 for potential newline
          searchOffset = end;
        }
      } else {
        searchOffset = end;
      }
      
      annotations.push({
        segmentId: segment.id,
        segmentIndex: index,
        span: {
          start: start !== -1 ? start : (annotations.length > 0 ? annotations[annotations.length - 1].span.end + 1 : 0),
          end: end,
        },
        text: segmentText,
        metadata: {
          ...(segment.title && { title: segment.title }),
          ...(segment.author && { author: segment.author }),
          ...(segment.title_bdrc_id && { title_bdrc_id: segment.title_bdrc_id }),
          ...(segment.author_bdrc_id && { author_bdrc_id: segment.author_bdrc_id }),
        },
      });
    });

    // Create comprehensive output
    const output = {
      textContent: {
        // fullText: textContent,
        totalLength: textContent.length,
        totalSegments: segments.length,
      },
      segmentation: {
        method: 'split_by_newlines_with_manual_splits',
        segments: annotations.map(ann => ({
          segmentId: ann.segmentId,
          segmentIndex: ann.segmentIndex,
          span: {
            start: ann.span.start,
            end: ann.span.end,
            length: ann.span.end - ann.span.start,
          },
          textLength: ann.text.length,
        })),
      },
      annotations: annotations.map(ann => ({
        segmentId: ann.segmentId,
        segmentIndex: ann.segmentIndex,
        span: {
          start: ann.span.start,
          end: ann.span.end,
          length: ann.span.end - ann.span.start,
        },
        metadata: ann.metadata,
      })),
      summary: {
        totalSegments: segments.length,
        annotatedSegments: segments.filter(s => 
          s.title || s.author || s.title_bdrc_id || s.author_bdrc_id
        ).length,
        segmentsWithTitle: segments.filter(s => s.title).length,
        segmentsWithAuthor: segments.filter(s => s.author).length,
        segmentsWithTitleBdrcId: segments.filter(s => s.title_bdrc_id).length,
        segmentsWithAuthorBdrcId: segments.filter(s => s.author_bdrc_id).length,
        totalTextLength: textContent.length,
        totalSegmentsTextLength: segments.reduce((sum, s) => sum + s.text.length, 0),
      },
    };

  }, [textContent, segments]);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
  

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-96 bg-white border-r border-gray-200 flex flex-col font-monlam-2">
          <div className="p-6 overflow-y-auto flex-1">
            {activeSegment ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Boundary Detection
                  </h2>
                  <div className="text-sm text-gray-600 mb-4 p-3 bg-gray-50 rounded-md border border-gray-200">
                    <div className="font-medium mb-1">Text:</div>
                    <div className="text-gray-800">{activeSegment.text.slice(0, 100)}...</div>
                  </div>
                </div>

                {/* Title Field */}
                <div>
                  <Label htmlFor="title" className="mb-2">
                    Title
                    {activeSegment.title_bdrc_id && (
                      <span className="ml-2 text-xs text-green-600 font-normal">
                        (BDRC: {activeSegment.title_bdrc_id})
                      </span>
                    )}
                  </Label>
                  <div className="relative">
                    <Input
                      ref={titleInputRef}
                      id="title"
                      value={titleSearch || activeSegment.title || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setTitleSearch(value);
                        // Only update search query if not selecting from dropdown
                        if (!isSelectingFromDropdown.current.title) {
                          setTitleSearchQuery(value);
                        }
                        setShowTitleDropdown(value.length > 0);
                        if (activeSegmentId) {
                          updateSegmentAnnotation(activeSegmentId, 'title', value);
                          // Clear BDRC ID if title is cleared
                          if (!value && activeSegment.title_bdrc_id) {
                            updateSegmentAnnotation(activeSegmentId, 'title_bdrc_id', '');
                          }
                        }
                      }}
                      onFocus={() => setShowTitleDropdown(titleSearch.length > 0)}
                      placeholder="Enter title"
                      className="w-full pr-8"
                    />
                    {activeSegment.title_bdrc_id && (
                      <button
                        type="button"
                        onClick={() => {
                          if (activeSegmentId) {
                            updateSegmentAnnotation(activeSegmentId, 'title_bdrc_id', '');
                          }
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-600 transition-colors"
                        title="Reset BDRC ID"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    {titleLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                      </div>
                    )}
                    {showTitleDropdown && titleResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {titleResults.map((title, index) => (
                          <button
                            key={title.workId || index}
                            type="button"
                            onClick={() => handleTitleSelect(title)}
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                          >
                            <div className="text-sm font-medium text-gray-900">
                              {title.title}
                            </div>
                            {title.workId && (
                              <div className="text-xs text-gray-500">ID: {title.workId}</div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Author Field */}
                <div>
                  <Label htmlFor="author" className="mb-2">
                    Author
                    {activeSegment.author_bdrc_id && (
                      <span className="ml-2 text-xs text-green-600 font-normal">
                        (BDRC: {activeSegment.author_bdrc_id})
                      </span>
                    )}
                  </Label>
                  <div className="relative">
                    <Input
                      ref={authorInputRef}
                      id="author"
                      value={authorSearch || activeSegment.author || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setAuthorSearch(value);
                        // Only update search query if not selecting from dropdown
                        if (!isSelectingFromDropdown.current.author) {
                          setAuthorSearchQuery(value);
                        }
                        setShowAuthorDropdown(value.length > 0);
                        if (activeSegmentId) {
                          updateSegmentAnnotation(activeSegmentId, 'author', value);
                          // Clear BDRC ID if author is cleared
                          if (!value && activeSegment.author_bdrc_id) {
                            updateSegmentAnnotation(activeSegmentId, 'author_bdrc_id', '');
                          }
                        }
                      }}
                      onFocus={() => setShowAuthorDropdown(authorSearch.length > 0)}
                      placeholder="Search or enter author name"
                      className="w-full pr-8"
                    />
                    {activeSegment.author_bdrc_id && (
                      <button
                        type="button"
                        onClick={() => {
                          if (activeSegmentId) {
                            updateSegmentAnnotation(activeSegmentId, 'author_bdrc_id', '');
                          }
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-600 transition-colors"
                        title="Reset BDRC ID"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    {authorLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                      </div>
                    )}
                    {showAuthorDropdown && authorResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {authorResults.map((author, index) => (
                          <button
                            key={author.bdrc_id || index}
                            type="button"
                            onClick={() => handleAuthorSelect(author)}
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                          >
                            <div className="text-sm font-medium text-gray-900">
                              {author.name}
                            </div>
                            {author.bdrc_id && (
                              <div className="text-xs text-gray-500">ID: {author.bdrc_id}</div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Auto-detect Button */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAIDetect}
                    disabled={aiLoading}
                    className="flex-1 flex items-center justify-center gap-2"
                  >
                    {aiLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Auto-detect Title & Author
                      </>
                    )}
                  </Button>
                  {aiLoading && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAIStop}
                      className="px-3 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                      title="Stop AI suggestion"
                    >
                      <Square className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {/* AI Suggestions Box */}
                {aiSuggestions && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      AI Suggestions
                    </div>
                    <div className="space-y-3">
                      {/* Title Suggestion */}
                      {(aiSuggestions.suggested_title || aiSuggestions.title) && (
                        <div>
                          <div className="text-xs text-blue-600 font-medium mb-1">Title:</div>
                          <div className="text-sm text-blue-900 mb-2">
                            {aiSuggestions.title || aiSuggestions.suggested_title}
                          </div>
                          {aiSuggestions.suggested_title && (
                            <button
                              type="button"
                              onClick={() => {
                                if (activeSegmentId && aiSuggestions.suggested_title) {
                                  updateSegmentAnnotation(activeSegmentId, 'title', aiSuggestions.suggested_title);
                                  setTitleSearch(aiSuggestions.suggested_title);
                                  setTitleSearchQuery(aiSuggestions.suggested_title);
                                }
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 underline"
                            >
                              Use this suggestion
                            </button>
                          )}
                        </div>
                      )}
                      {/* Author Suggestion */}
                      {(aiSuggestions.suggested_author || aiSuggestions.author) && (
                        <div>
                          <div className="text-xs text-blue-600 font-medium mb-1">Author:</div>
                          <div className="text-sm text-blue-900 mb-2">
                            {aiSuggestions.author || aiSuggestions.suggested_author}
                          </div>
                          {aiSuggestions.suggested_author && (
                            <button
                              type="button"
                              onClick={() => {
                                if (activeSegmentId && aiSuggestions.suggested_author) {
                                  updateSegmentAnnotation(activeSegmentId, 'author', aiSuggestions.suggested_author);
                                  setAuthorSearch(aiSuggestions.suggested_author);
                                  setAuthorSearchQuery(aiSuggestions.suggested_author);
                                }
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 underline"
                            >
                              Use this suggestion
                            </button>
                          )}
                        </div>
                      )}
                      {/* Show message if no suggestions */}
                      {!aiSuggestions.suggested_title && !aiSuggestions.title && !aiSuggestions.suggested_author && !aiSuggestions.author && (
                        <div className="text-sm text-blue-700 italic">
                          No suggestions available for this segment.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-12">
                <p>No segment selected</p>
                <p className="text-sm mt-2">Click on a segment in the workspace to annotate it</p>
              </div>
            )}
          </div>
          
          {/* Save Button */}
          <div className="p-6 border-t border-gray-200 bg-white">
            <Button
              type="button"
              onClick={handleSave}
              disabled={!textContent || segments.length === 0}
              className="w-full"
              variant="default"
            >
              Save Annotations
            </Button>
          </div>
        </div>

        {/* Main Workspace */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!textContent ? (
            <div className="flex-1 flex items-center justify-center p-12">
              <div className="w-full max-w-2xl">
                <FileUploadZone onFileUpload={handleFileUpload} />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Workspace Header */}
              <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Text Workspace</h2>
                  <p className="text-sm text-gray-600">
                    {segments.length} segment{segments.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setTextContent('');
                    setSegments([]);
                    setActiveSegmentId(null);
                  }}
                >
                  Load New File
                </Button>
              </div>

              {/* Text Display */}
              <div
                ref={workspaceRef}
                className="flex-1 overflow-y-auto p-6 bg-white relative"
                onMouseUp={handleTextSelection}
              >
                {segments.map((segment, index) => {
                  const isFirstSegment = index === 0;
                  const isAttached = isFirstSegment && segment.parentSegmentId !== undefined;
                  
                  return (
                    <div key={segment.id}>
                      {/* Attach Parent Button - only for first segment */}
                      {isFirstSegment && (
                        <div className="mb-2 flex justify-start">
                          <Button
                            type="button"
                            variant={isAttached ? "default" : "outline"}
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAttachParent();
                            }}
                            className={`text-xs ${
                              isAttached 
                                ? 'bg-green-600 hover:bg-green-700 text-white' 
                                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {isAttached ? '✓ Attached' : 'Attach Parent'}
                          </Button>
                          {isAttached && (
                            <span className="ml-2 text-xs text-gray-500 flex items-center">
                              (Linked to: {previousDataLastSegmentId})
                            </span>
                          )}
                        </div>
                      )}
                      
                      <div
                        data-segment-id={segment.id}
                        data-segment-container-id={segment.id}
                        ref={(el) => {
                          if (el) {
                            segmentRefs.current.set(segment.id, el);
                          } else {
                            segmentRefs.current.delete(segment.id);
                          }
                        }}
                        onClick={(e) => {
                          // Only handle click if not clicking on text content or split menu
                          if (!(e.target as HTMLElement).closest('.segment-text-content') &&
                              !(e.target as HTMLElement).closest('.split-menu')) {
                            handleSegmentClick(segment.id, e);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSegmentClick(segment.id);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        className={`
                          mb-4 p-4 rounded-lg border-2 cursor-pointer transition-all relative
                          ${
                            segment.id === activeSegmentId
                              ? 'border-blue-500 bg-blue-50 shadow-md'
                              : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'
                          }
                        `}
                      >
                        <div className="flex items-start gap-3">
                        <div className="shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                          {index + 1}
                        </div>
                        <div className="flex-1 relative">
                          <SegmentTextContent
                            segmentId={segment.id}
                            text={segment.text}
                            title={segment.title}
                            author={segment.author}
                            onCursorChange={handleCursorChange}
                            onActivate={() => setActiveSegmentId(segment.id)}
                            onInput={handleContentEditableInput}
                            onKeyDown={handleContentEditableKeyDown}
                            ref={(el: HTMLDivElement | null) => {
                              if (el) {
                                // Store the text element reference separately if needed
                              }
                            }}
                          />
                        {(segment.title || segment.author || segment.title_bdrc_id || segment.author_bdrc_id) && (
                          <div className="mt-3 pt-3 border-t border-gray-200 flex flex-wrap gap-2">
                            {segment.title && (
                              <span className="inline-flex items-center px-2 py-1 rounded-md bg-yellow-100 text-yellow-800 text-xs font-medium">
                                📄 {segment.title}
                                {segment.title_bdrc_id && (
                                  <span className="ml-1 text-green-600">({segment.title_bdrc_id})</span>
                                )}
                              </span>
                            )}
                            {segment.author && (
                              <span className="inline-flex items-center px-2 py-1 rounded-md bg-purple-100 text-purple-800 text-xs font-medium">
                                👤 {segment.author}
                                {segment.author_bdrc_id && (
                                  <span className="ml-1 text-green-600">({segment.author_bdrc_id})</span>
                                )}
                              </span>
                            )}
                          </div>
                        )}
                        </div>
                      </div>
                      
                      {/* Split Menu - positioned relative to segment container */}
                      {cursorPosition && cursorPosition.segmentId === segment.id && cursorPosition.menuPosition && (
                        <SplitMenu
                          position={cursorPosition.menuPosition}
                          onSplit={handleSplitSegment}
                          onClose={() => {
                            setCursorPosition(null);
                          }}
                        />
                      )}
                      
                      {/* Bubble Menu - positioned relative to segment container (same as split menu) */}
                      {bubbleMenuState && bubbleMenuState.segmentId === segment.id && (
                        <BubbleMenu
                          position={bubbleMenuState.position}
                          onSelect={(field) => handleBubbleMenuSelect(field, segment.id, bubbleMenuState.selectedText)}
                          onClose={() => {
                            setBubbleMenuState(null);
                          }}
                        />
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default MockLongCataloger;
