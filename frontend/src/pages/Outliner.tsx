import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useOutlinerDocument } from '@/hooks/useOutlinerDocument';
import { useSegmentAnnotations } from '@/hooks/useSegmentAnnotations';
import { useAISuggestions } from '@/hooks/useAISuggestions';
import { useAITextEndings } from '@/hooks/useAITextEndings';
import { SEGMENT_SPLIT_MARKER } from '@/components/outliner';
import type {
  TextSegment,
  BubbleMenuState,
  CursorPosition,
} from '@/components/outliner';
import { AnnotationSidebar } from '@/components/outliner/AnnotationSidebar';
import { Workspace } from '@/components/outliner/Workspace';
import { OutlinerProvider } from '@/components/outliner/OutlinerContext';
import { useAuth0 } from '@auth0/auth0-react';

function Outliner() {
  const { user } = useAuth0();
  
  // Backend integration hook
  const {
    documentId,
    textContent: backendTextContent,
    segments: backendSegments,
    isLoading: isLoadingDocument,
    isSaving,
    uploadFile,
    updateSegment: updateSegmentBackend,
    splitSegment: splitSegmentBackend,
    mergeSegments: mergeSegmentsBackend,
  } = useOutlinerDocument({
    onDocumentLoaded: (document) => {
      // Initialize local state from backend document
      if (document.segments && document.segments.length > 0) {
        const loadedSegments = document.segments.map((seg) => ({
          id: seg.id,
          text: seg.text,
          title: seg.title || undefined,
          author: seg.author || undefined,
          title_bdrc_id: seg.title_bdrc_id || undefined,
          author_bdrc_id: seg.author_bdrc_id || undefined,
          parentSegmentId: seg.parent_segment_id || undefined,
        }));
        setSegments(loadedSegments);
        if (loadedSegments.length > 0) {
          setActiveSegmentId(loadedSegments[0].id);
        }
      }
    },
  });

  // Local state (used when no documentId, or for UI state)
  const [textContent, setTextContent] = useState<string>('');
  const [segments, setSegments] = useState<TextSegment[]>([]);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  
  // Use backend data if available, otherwise use local state
  const currentTextContent = documentId ? backendTextContent : textContent;
  const currentSegments = documentId ? backendSegments : segments;
  // Generate a random ID for the last segment of previous data (mock)
  const [previousDataLastSegmentId] = useState<string>(
    () => `prev-segment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );
  const [bubbleMenuState, setBubbleMenuState] = useState<BubbleMenuState | null>(null);
  const [cursorPosition, setCursorPosition] = useState<CursorPosition | null>(null);
  const workspaceRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;
  const segmentRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // AI text ending detection hook
  const [previousSegments, setPreviousSegments] = useState<TextSegment[] | null>(null);
  const aiTextEndingAbortControllerRef = useRef<AbortController | null>(null);
  const aiTextEndings = useAITextEndings({
    documentId: documentId || undefined,
    onSuccess: () => {
      // Success handling is done via query invalidation
    },
    onError: (error) => {
      console.error('Error detecting text endings:', error);
    },
  });

  // Get active segment
  const activeSegment = currentSegments.find((seg) => seg.id === activeSegmentId);

  // Handle file upload (local mode - for backward compatibility)
  const handleFileUpload = useCallback((content: string) => {
    if (documentId) {
      // If we have a documentId, we should use backend upload instead
      return;
    }
    setTextContent(content);
    // Split content by split marker to create segments
    const parts = content.split(SEGMENT_SPLIT_MARKER).filter((part) => part.trim().length > 0);
    const newSegments: TextSegment[] = parts.map((part, index) => ({
      id: `segment-${index}`,
      text: part.trim(),
    }));
    setSegments(newSegments);
    // Set first segment as active
    if (newSegments.length > 0) {
      setActiveSegmentId(newSegments[0].id);
    }
  }, [documentId]);

  // Handle file upload to backend
  const handleFileUploadToBackend = useCallback(
    async (file: File) => {
      await uploadFile(file, user?.sub);
    },
    [uploadFile, user]
  );

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

    for (const segment of currentSegments) {
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
      const segmentContainer = targetSegmentElement.closest(
        '[data-segment-container-id]'
      ) as HTMLElement;

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
  }, [currentSegments]);

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
  const handleContentEditableInput = useCallback(
    (e: React.FormEvent<HTMLDivElement>) => {
      e.preventDefault();
      // Restore the original content
      const target = e.currentTarget;
      const segmentId = target.getAttribute('data-segment-id');
      if (segmentId) {
        const segment = currentSegments.find((seg) => seg.id === segmentId);
        if (segment) {
          // Use setTimeout to restore after browser tries to update
          setTimeout(() => {
            target.textContent = segment.text;
          }, 0);
        }
      }
    },
    [currentSegments]
  );

  // Handle contentEditable keydown to prevent content changes
  const handleContentEditableKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Allow navigation keys
    const allowedKeys = [
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
      'PageUp',
      'PageDown',
      'Tab',
      'Escape',
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
    setSegments((prev) =>
      prev.map((seg) => {
        if (seg.id === firstSegmentId) {
          return {
            ...seg,
            parentSegmentId: seg.parentSegmentId ? undefined : previousDataLastSegmentId,
          };
        }
        return seg;
      })
    );
  }, [segments, previousDataLastSegmentId]);

  // Split segment at cursor position
  const handleSplitSegment = useCallback(async () => {
    if (!cursorPosition || !activeSegmentId) return;

    const segment = currentSegments.find((seg) => seg.id === cursorPosition.segmentId);
    if (!segment) return;

    const textBefore = segment.text.substring(0, cursorPosition.offset).trim();
    const textAfter = segment.text.substring(cursorPosition.offset).trim();

    // Don't split if either part would be empty
    if (!textBefore || !textAfter) {
      return;
    }

    // If we have a documentId, use backend split
    if (documentId) {
      try {
        await splitSegmentBackend(cursorPosition.segmentId, cursorPosition.offset);
        setCursorPosition(null);
        return;
      } catch (error) {
        console.error('Failed to split segment:', error);
        return;
      }
    }

    // Local mode - update textContent to include the split marker
    const segmentStartInText = currentTextContent.indexOf(segment.text);
    if (segmentStartInText !== -1) {
      const absoluteSplitPosition = segmentStartInText + cursorPosition.offset;
      const newTextContent =
        currentTextContent.substring(0, absoluteSplitPosition) +
        SEGMENT_SPLIT_MARKER +
        currentTextContent.substring(absoluteSplitPosition);
      setTextContent(newTextContent);
    }

    // Create new segments
    const newSegments = [...currentSegments];
    const segmentIndex = newSegments.findIndex((seg) => seg.id === cursorPosition.segmentId);
    if (segmentIndex === -1) return;

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
  }, [cursorPosition, currentSegments, activeSegmentId, currentTextContent, documentId, splitSegmentBackend]);

  // Merge segment with previous segment
  const handleMergeWithPrevious = useCallback(
    async (segmentId: string) => {
      const segmentIndex = currentSegments.findIndex((seg) => seg.id === segmentId);
      if (segmentIndex <= 0) {
        // Can't merge if it's the first segment or not found
        return;
      }

      const currentSegment = currentSegments[segmentIndex];
      const previousSegment = currentSegments[segmentIndex - 1];

      // If we have a documentId, use backend merge
      if (documentId) {
        try {
          await mergeSegmentsBackend([previousSegment.id, currentSegment.id]);
          setCursorPosition(null);
          return;
        } catch (error) {
          console.error('Failed to merge segments:', error);
          return;
        }
      }

      // Local mode
      // Combine text - merge without adding extra spaces if not needed
      const mergedText = previousSegment.text + currentSegment.text;

      // Preserve metadata from previous segment (or merge if current has metadata but previous doesn't)
      const mergedSegment: TextSegment = {
        id: previousSegment.id,
        text: mergedText,
        title: previousSegment.title || currentSegment.title,
        author: previousSegment.author || currentSegment.author,
        title_bdrc_id: previousSegment.title_bdrc_id || currentSegment.title_bdrc_id,
        author_bdrc_id: previousSegment.author_bdrc_id || currentSegment.author_bdrc_id,
        parentSegmentId: previousSegment.parentSegmentId,
      };

      // Update textContent - remove the split marker between these segments
      // Find positions of both segments in textContent
      const previousSegmentStart = currentTextContent.indexOf(previousSegment.text);
      const currentSegmentStart = currentTextContent.indexOf(
        currentSegment.text,
        previousSegmentStart >= 0 ? previousSegmentStart : 0
      );

      if (previousSegmentStart !== -1 && currentSegmentStart !== -1) {
        // Calculate where current segment ends
        const currentSegmentEnd = currentSegmentStart + currentSegment.text.length;

        // Get text before previous segment and after current segment
        const beforePrevious = currentTextContent.substring(0, previousSegmentStart);
        const afterCurrent = currentTextContent.substring(currentSegmentEnd);

        // Replace the section from previous segment start to current segment end with merged text
        // mergedText already includes proper spacing
        const newTextContent = beforePrevious + mergedText + afterCurrent;

        setTextContent(newTextContent);
      }

      // Update segments array
      const newSegments = [...currentSegments];
      newSegments[segmentIndex - 1] = mergedSegment;
      newSegments.splice(segmentIndex, 1); // Remove current segment

      setSegments(newSegments);
      setActiveSegmentId(previousSegment.id);
      setCursorPosition(null);
    },
    [currentSegments, currentTextContent, documentId, mergeSegmentsBackend]
  );

  // Update segment annotation
  const updateSegmentAnnotation = useCallback(
    async (
      segmentId: string,
      field: 'title' | 'author' | 'title_bdrc_id' | 'author_bdrc_id',
      value: string
    ) => {
      // Update local state immediately for UI responsiveness
      const updateLocalState = () => {
        if (documentId) {
          // For backend mode, segments are managed by backend
          // Local update will be synced via backend response
          return;
        }
        setSegments((prev) =>
          prev.map((seg) => {
            if (seg.id === segmentId) {
              return {
                ...seg,
                [field]: value,
              };
            }
            return seg;
          })
        );
      };

      updateLocalState();

      // Sync to backend if we have a documentId
      if (documentId) {
        try {
          await updateSegmentBackend(segmentId, { [field]: value });
        } catch (error) {
          console.error('Failed to update segment:', error);
          // Optionally revert local state on error
        }
      }
    },
    [documentId, updateSegmentBackend]
  );

  // Segment annotations hook (handles title/author with BDRC search)
  const segmentAnnotations = useSegmentAnnotations({
    activeSegment,
    activeSegmentId,
    onUpdate: updateSegmentAnnotation,
  });

  // AI suggestions hook
  const aiSuggestions = useAISuggestions({
    activeSegment,
    activeSegmentId,
    documentId: documentId || undefined,
    onUpdate: updateSegmentAnnotation,
    onTitleChange: segmentAnnotations.onTitleChange,
    onAuthorChange: segmentAnnotations.onAuthorChange,
    onShowTitleDropdown: () => {}, // Handled internally by segmentAnnotations
    onShowAuthorDropdown: () => {}, // Handled internally by segmentAnnotations
  });

  // Handle bubble menu selection
  const handleBubbleMenuSelect = useCallback(
    (field: 'title' | 'author', segmentId: string, text: string) => {
      if (!segmentId || !text) return;

      // Update the segment annotation
      updateSegmentAnnotation(segmentId, field, text);

      setBubbleMenuState(null);
    },
    [updateSegmentAnnotation]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (aiTextEndingAbortControllerRef.current) {
        aiTextEndingAbortControllerRef.current.abort();
      }
    };
  }, []);

  // Helper function to create segments from starting positions
  const createSegmentsFromPositions = useCallback(
    (startingPositions: number[]): TextSegment[] => {
      const textLength = currentTextContent.length;
      const validPositions = startingPositions
        .map((pos) => Math.max(0, Math.min(pos, textLength)))
        .filter((pos, index, arr) => index === 0 || pos > arr[index - 1]); // Remove duplicates and ensure sorted

      if (validPositions.length === 0) {
        return [];
      }

      const newSegments: TextSegment[] = [];
      const timestamp = Date.now();
      for (let i = 0; i < validPositions.length; i++) {
        const start = validPositions[i];
        const end = i < validPositions.length - 1 ? validPositions[i + 1] : textLength;

        const segmentText = currentTextContent.substring(start, end).trim();

        if (segmentText.length > 0) {
          newSegments.push({
            id: `segment-${timestamp}-${i}`,
            text: segmentText,
          });
        }
      }

      return newSegments;
    },
    [currentTextContent]
  );

  // AI detect text endings and create new segmentation
  const handleAIDetectTextEndings = useCallback(async () => {
    if (!currentTextContent || currentTextContent.trim().length === 0) return;

    // Abort any existing request
    if (aiTextEndingAbortControllerRef.current) {
      aiTextEndingAbortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    const abortController = new AbortController();
    aiTextEndingAbortControllerRef.current = abortController;

    // Store current segments for undo (capture current value)
    const segmentsForUndo = [...currentSegments];
    setPreviousSegments(segmentsForUndo);

    try {
      // Check if text contains Tibetan marker "༄༅༅"
      const tibetanMarker = '༄༅༅། །';
      const markerPositions: number[] = [];

      if (currentTextContent.includes(tibetanMarker)) {
        // Find all occurrences of the marker
        let searchIndex = 0;
        while (true) {
          const index = currentTextContent.indexOf(tibetanMarker, searchIndex);
          if (index === -1) break;
          markerPositions.push(index);
          searchIndex = index + 1;
        }

        // Always include position 0 as the first segment start
        const startingPositions = [0, ...markerPositions].filter(
          (pos, index, arr) => index === 0 || pos > arr[index - 1]
        );

        // Create segments from marker positions
        const newSegments = createSegmentsFromPositions(startingPositions);

        if (newSegments.length > 0) {
          setSegments(newSegments);
          setActiveSegmentId(newSegments[0].id);
        } else {
          throw new Error('No valid segments created from marker positions');
        }

        aiTextEndingAbortControllerRef.current = null;
        return;
      }

      // If no marker found, use AI API approach with React Query
      // Get the current selected segment text, or use currentTextContent if no segment is selected
      const activeSegment = activeSegmentId
        ? currentSegments.find((seg) => seg.id === activeSegmentId)
        : null;
      const contentToSend = activeSegment ? activeSegment.text : currentTextContent;
      const actualContentWithoutSplitMarker = contentToSend.replaceAll(SEGMENT_SPLIT_MARKER, '');

      // Use React Query mutation for AI detection
      const data = await aiTextEndings.detectTextEndings({
        content: actualContentWithoutSplitMarker,
        signal: abortController.signal,
      });

      const { starting_positions } = data;

      if (!starting_positions || !Array.isArray(starting_positions) || starting_positions.length === 0) {
        throw new Error('Invalid response format');
      }

      // If an active segment is selected, apply segmentation only to that segment
      if (activeSegment) {
        // Find the segment's position in currentSegments array
        const segmentIndex = currentSegments.findIndex((seg) => seg.id === activeSegmentId);
        if (segmentIndex === -1) {
          throw new Error('Active segment not found');
        }

        // Create new segments from the segment's content using relative positions
        // The AI positions are relative to the segment's content (starting from 0)
        const segmentText = activeSegment.text;
        const segmentTextLength = segmentText.length;
        const newSegmentsFromSegment: TextSegment[] = [];
        const timestamp = Date.now();
        
        for (let i = 0; i < starting_positions.length; i++) {
          const relativeStart = Math.max(0, Math.min(starting_positions[i], segmentTextLength));
          const relativeEnd = i < starting_positions.length - 1 
            ? Math.max(0, Math.min(starting_positions[i + 1], segmentTextLength))
            : segmentTextLength;

          const segmentTextPart = segmentText.substring(relativeStart, relativeEnd).trim();

          if (segmentTextPart.length > 0) {
            newSegmentsFromSegment.push({
              id: `segment-${timestamp}-${i}`,
              text: segmentTextPart,
              // Preserve metadata from the original segment for the first new segment
              ...(i === 0 && {
                title: activeSegment.title,
                author: activeSegment.author,
                title_bdrc_id: activeSegment.title_bdrc_id,
                author_bdrc_id: activeSegment.author_bdrc_id,
                parentSegmentId: activeSegment.parentSegmentId,
              }),
            });
          }
        }

        if (newSegmentsFromSegment.length === 0) {
          throw new Error('No valid segments created from AI detection');
        }

        // Replace only the selected segment with the new segments in the currentSegments array
        const newSegments = [...currentSegments];
        newSegments.splice(segmentIndex, 1, ...newSegmentsFromSegment);

        // Update textContent by reconstructing it from all segments
        // This ensures all segments are correctly represented with proper markers
        const updatedTextContent = newSegments
          .map((seg) => seg.text)
          .join(SEGMENT_SPLIT_MARKER);

        setTextContent(updatedTextContent);
        setSegments(newSegments);

        // Set first new segment as active
        if (newSegmentsFromSegment.length > 0) {
          setActiveSegmentId(newSegmentsFromSegment[0].id);
        }
      } else {
        // No active segment selected, apply to whole textContent (existing behavior)
        const newSegments = createSegmentsFromPositions(starting_positions);

        if (newSegments.length === 0) {
          throw new Error('No valid segments created from AI detection');
        }

        // Update segments
        setSegments(newSegments);

        // Set first segment as active if available
        if (newSegments.length > 0) {
          setActiveSegmentId(newSegments[0].id);
        }
      }
    } catch (error) {
      // Don't log error if it was aborted
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error detecting text endings:', error);
        // Restore previous segments on error
        if (previousSegments) {
          setSegments(previousSegments);
          setPreviousSegments(null);
        }
      }
    } finally {
      // Only reset abort controller if this request wasn't aborted
      if (!abortController.signal.aborted) {
        aiTextEndingAbortControllerRef.current = null;
      }
    }
  }, [currentTextContent, currentSegments, createSegmentsFromPositions, activeSegmentId, aiTextEndings, previousSegments]);

  // Stop AI text ending detection request
  const handleAITextEndingStop = useCallback(() => {
    if (aiTextEndingAbortControllerRef.current) {
      aiTextEndingAbortControllerRef.current.abort();
      aiTextEndingAbortControllerRef.current = null;
    }
    aiTextEndings.reset();
  }, [aiTextEndings]);

  // Undo AI text ending detection
  const handleUndoTextEndingDetection = useCallback(() => {
    if (previousSegments) {
      setSegments(previousSegments);
      setPreviousSegments(null);
      // Set first segment as active if available
      if (previousSegments.length > 0) {
        setActiveSegmentId(previousSegments[0].id);
      }
    }
  }, [previousSegments]);

  // Save annotations with span information
  const handleSave = useCallback(() => {
    if (!currentTextContent || currentSegments.length === 0) {
      return;
    }

    // Calculate span addresses for each segment
    // Find each segment's text position in the original currentTextContent
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

    currentSegments.forEach((segment, index) => {
      const segmentText = segment.text;

      // Try to find the segment text in the original currentTextContent
      // Start searching from the previous segment's end position
      const start = currentTextContent.indexOf(segmentText, searchOffset);
      let end = start + segmentText.length;

      // If not found, calculate based on cumulative length
      if (start === -1) {
        // Fallback: calculate based on previous segments
        const previousEnd =
          annotations.length > 0 ? annotations[annotations.length - 1].span.end : 0;
        // Try to find a reasonable position by searching from beginning
        const fallbackStart = currentTextContent.indexOf(segmentText, 0);
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
          start: start !== -1 ? start : annotations.length > 0 ? annotations[annotations.length - 1].span.end + 1 : 0,
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
  }, [currentTextContent, currentSegments]);

  return (
    <OutlinerProvider
      value={{
        textContent: currentTextContent,
        segments: currentSegments,
        activeSegmentId,
        previousDataLastSegmentId,
        bubbleMenuState,
        cursorPosition,
        aiTextEndingLoading: aiTextEndings.isLoading,
        previousSegments,
        workspaceRef: workspaceRef as React.RefObject<HTMLDivElement>,
        segmentRefs,
        onFileUpload: handleFileUpload,
        onFileUploadToBackend: handleFileUploadToBackend,
        isUploading: isLoadingDocument || isSaving,
        onTextSelection: handleTextSelection,
        onSegmentClick: handleSegmentClick,
        onCursorChange: handleCursorChange,
        onActivate: setActiveSegmentId,
        onInput: handleContentEditableInput,
        onKeyDown: handleContentEditableKeyDown,
        onAttachParent: handleAttachParent,
        onMergeWithPrevious: handleMergeWithPrevious,
        onBubbleMenuSelect: handleBubbleMenuSelect,
        onSplitSegment: handleSplitSegment,
        onAIDetectTextEndings: handleAIDetectTextEndings,
        onAITextEndingStop: handleAITextEndingStop,
        onUndoTextEndingDetection: handleUndoTextEndingDetection,
        onLoadNewFile: () => {
          setTextContent('');
          setSegments([]);
          setActiveSegmentId(null);
          setPreviousSegments(null);
        },
      }}
    >
      <div className="h-screen flex flex-col bg-gray-50">
        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <AnnotationSidebar
            activeSegment={activeSegment}
            textContent={currentTextContent}
            segments={currentSegments}
            onSave={handleSave}
            titleValue={segmentAnnotations.titleSearch}
            titleResults={segmentAnnotations.titleResults}
            titleLoading={segmentAnnotations.titleLoading}
            showTitleDropdown={segmentAnnotations.showTitleDropdown}
            titleInputRef={segmentAnnotations.titleInputRef}
            onTitleChange={segmentAnnotations.onTitleChange}
            onTitleFocus={segmentAnnotations.onTitleFocus}
            onTitleSelect={segmentAnnotations.onTitleSelect}
            onTitleBdrcIdClear={segmentAnnotations.onTitleBdrcIdClear}
            authorValue={segmentAnnotations.authorSearch}
            authorResults={segmentAnnotations.authorResults}
            authorLoading={segmentAnnotations.authorLoading}
            showAuthorDropdown={segmentAnnotations.showAuthorDropdown}
            authorInputRef={segmentAnnotations.authorInputRef}
            onAuthorChange={segmentAnnotations.onAuthorChange}
            onAuthorFocus={segmentAnnotations.onAuthorFocus}
            onAuthorSelect={segmentAnnotations.onAuthorSelect}
            onAuthorBdrcIdClear={segmentAnnotations.onAuthorBdrcIdClear}
            aiSuggestions={aiSuggestions.aiSuggestions}
            aiLoading={aiSuggestions.aiLoading}
            onAIDetect={aiSuggestions.onAIDetect}
            onAIStop={aiSuggestions.onAIStop}
            onAISuggestionUse={aiSuggestions.onAISuggestionUse}
          />

          {/* Main Workspace */}
          <Workspace />
        </div>
      </div>
    </OutlinerProvider>
  );
}

export default Outliner;
