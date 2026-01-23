import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useOutlinerDocument } from '@/hooks/useOutlinerDocument';
import { useAITextEndings } from '@/hooks/useAITextEndings';
import type {
  TextSegment,
  BubbleMenuState,
  CursorPosition,
} from '@/components/outliner';
import { AnnotationSidebar, type AnnotationSidebarRef } from '@/components/outliner/AnnotationSidebar';
import { Workspace } from '@/components/outliner/Workspace';
import { OutlinerProvider } from '@/components/outliner/OutlinerContext';

const OutlinerWorkspace: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Get activeSegmentId from URL
  const activeSegmentId = searchParams.get('segmentId');
  
  // Backend integration hook
  const {
    documentId,
    textContent: currentTextContent,
    segments:currentSegments,
    isLoading: isLoadingDocument,
    isSaving,
    segmentLoadingStates,
    updateSegment: updateSegmentBackend,
    splitSegment: splitSegmentBackend,
    mergeSegments: mergeSegmentsBackend,
    resetSegments: resetSegmentsBackend,
    createSegmentsBulk: createSegmentsBulkBackend,
  } = useOutlinerDocument();
  
  // Use backend data directly
  
  // Set initial activeSegmentId from URL or first segment
  useEffect(() => {
    if (currentSegments.length > 0 && !activeSegmentId) {
      setSearchParams({ segmentId: currentSegments[0].id }, { replace: true });
    }
  }, [currentSegments, activeSegmentId, setSearchParams]);
  
  // UI state for menus
  const [bubbleMenuState, setBubbleMenuState] = useState<BubbleMenuState | null>(null);
 
  const [cursorPosition, setCursorPosition] = useState<CursorPosition | null>(null);
  
  // Store pending bubble menu value to apply when segment becomes active
  const pendingBubbleMenuValueRef = useRef<{ field: 'title' | 'author'; segmentId: string; text: string } | null>(null);

  // AI text ending detection hook
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

  // Apply pending bubble menu value when segment becomes active
  useEffect(() => {
    if (pendingBubbleMenuValueRef.current && activeSegmentId === pendingBubbleMenuValueRef.current.segmentId) {
      const { field, text } = pendingBubbleMenuValueRef.current;
      
      // Use requestAnimationFrame to ensure sidebar has updated
      requestAnimationFrame(() => {
        if (field === 'title') {
          annotationSidebarRef.current?.setTitleValueWithoutUpdate(text);
        } else if (field === 'author') {
          annotationSidebarRef.current?.setAuthorValueWithoutUpdate(text);
        }
        pendingBubbleMenuValueRef.current = null;
      });
    }
  }, [activeSegmentId]);

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
        const menuHeight = 100; // Approximate bubble menu height
        const gap = 8; // Gap between selection and menu
        const padding = 8;
        const viewportHeight = window.innerHeight;

        // Calculate initial position below selection, relative to segment container
        const menuPosition = {
          x: rect.left - segmentRect.left - menuWidth / 2 + rect.width / 2,
          y: rect.bottom - segmentRect.top + gap, // 8px gap below selection
        };

        // Convert to viewport coordinates to check boundaries
        const viewportY = segmentRect.top + menuPosition.y;

        // Check if menu would overflow below viewport
        let adjustedY = menuPosition.y;
        if (viewportY + menuHeight + padding > viewportHeight) {
          // Position above selection instead
          adjustedY = rect.top - segmentRect.top - menuHeight - gap;
        }

        // Ensure menu stays within segment bounds horizontally (with padding)
        let adjustedX = menuPosition.x;
        if (adjustedX < padding) {
          adjustedX = padding;
        }
        if (adjustedX + menuWidth > segmentRect.width - padding) {
          adjustedX = segmentRect.width - menuWidth - padding;
        }

        // Final viewport check: ensure menu doesn't go off-screen vertically
        const finalViewportY = segmentRect.top + adjustedY;
        if (finalViewportY < padding) {
          adjustedY = padding - segmentRect.top;
        }
        if (finalViewportY + menuHeight > viewportHeight - padding) {
          adjustedY = viewportHeight - padding - menuHeight - segmentRect.top;
        }

        setBubbleMenuState({
          segmentId: targetSegmentId,
          position: { x: adjustedX, y: adjustedY },
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

  // Handle segment click - update URL
  const handleSegmentClick = useCallback((segmentId: string, event?: React.MouseEvent) => {
    setSearchParams({ segmentId }, { replace: true });
    setBubbleMenuState(null);
    if (!event || !(event.target as HTMLElement).closest('.segment-text-content')) {
      setCursorPosition(null);
    }
  }, [setSearchParams]);

  // Handle cursor position change in contentEditable
  const handleCursorChange = useCallback((segmentId: string, element: HTMLDivElement) => {
    const selection = globalThis.getSelection();
    
    // If no selection exists, try to create one at the end of the element
    let range: Range;
    if (!selection || selection.rangeCount === 0) {
      // Create a range at the end of the element
      range = document.createRange();
      const textNode = element.firstChild;
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        const textLength = textNode.textContent?.length || 0;
        range.setStart(textNode, textLength);
        range.setEnd(textNode, textLength);
      } else {
        // If no text node, set at the element itself
        range.setStart(element, 0);
        range.setEnd(element, 0);
      }
      // Set the selection
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } else {
      range = selection.getRangeAt(0);
    }

    // Check if selection is within this segment/content
    if (!element.contains(range.commonAncestorContainer)) return;

    // Check if there's text selected - if yes, don't show split menu
    const selectedText = selection?.toString().trim() || '';
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
    const menuHeight = 50; // Approximate menu height
    const gap = 8; // Gap between cursor and menu
    const padding = 8;
    const viewportHeight = window.innerHeight;

    // Calculate initial position below cursor, relative to segment container
    // Position menu at cursor's left edge (aligned with cursor position)
    const menuPosition = {
      x: cursorRect.left - segmentRect.left,
      y: cursorRect.height > 0 
        ? cursorRect.bottom - segmentRect.top + gap
        : gap, // 8px gap below cursor
    };

    // Convert to viewport coordinates to check boundaries
    const viewportY = segmentRect.top + menuPosition.y;

    // Check if menu would overflow below viewport
    let adjustedY = menuPosition.y;
    if (viewportY + menuHeight + padding > viewportHeight) {
      // Position above cursor instead
      adjustedY = cursorRect.height > 0 
        ? cursorRect.top - segmentRect.top - menuHeight - gap
        : -menuHeight - gap;
    }

    // Ensure menu stays within segment bounds horizontally (with padding)
    let adjustedX = menuPosition.x;
    if (adjustedX < padding) {
      adjustedX = padding;
    }
    if (adjustedX + menuWidth > segmentRect.width - padding) {
      adjustedX = segmentRect.width - menuWidth - padding;
    }

    // Final viewport check: ensure menu doesn't go off-screen vertically
    const finalViewportY = segmentRect.top + adjustedY;
    if (finalViewportY < padding) {
      adjustedY = padding - segmentRect.top;
    }
    if (finalViewportY + menuHeight > viewportHeight - padding) {
      adjustedY = viewportHeight - padding - menuHeight - segmentRect.top;
    }

    // Show split menu and hide bubble menu when no text is selected
    setCursorPosition({ segmentId, offset, menuPosition: { x: adjustedX, y: adjustedY } });
    setBubbleMenuState(null);
  }, []);

  // Handle contentEditable input prevention
  const handleContentEditableInput = useCallback(
    (e: React.FormEvent<HTMLDivElement>) => {
      e.preventDefault();
      // Restore the original content
      const target = e.currentTarget;
      const segmentId = target.getAttribute('data-segment-id');
      if (segmentId === 'content-no-segments') {
        // Restore full text content when no segments
        setTimeout(() => {
          target.textContent = currentTextContent;
        }, 0);
      } else if (segmentId) {
        const segment = currentSegments.find((seg) => seg.id === segmentId);
        if (segment) {
          // Use setTimeout to restore after browser tries to update
          setTimeout(() => {
            target.textContent = segment.text;
          }, 0);
        }
      }
    },
    [currentSegments, currentTextContent]
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
  const handleAttachParent = useCallback(async () => {
    if (currentSegments.length === 0) return;
    if (!documentId) return; // Only works with backend documents

    const firstSegment = currentSegments[0];
    const firstSegmentId = firstSegment.id;

    // Toggle is_attached: if already attached, set to false; otherwise set to true
    const newIsAttached = !(firstSegment.is_attached ?? false);

    try {
      await updateSegmentBackend(firstSegmentId, {
        is_attached: newIsAttached,
      });
    } catch (error) {
      console.error('Failed to update attachment status:', error);
    }
  }, [currentSegments, documentId, updateSegmentBackend]);

  // Handle segment status update (checked/unchecked)
  const handleSegmentStatusUpdate = useCallback(
    async (segmentId: string, status: 'checked' | 'unchecked') => {
      if (!documentId) return;
      try {
        await updateSegmentBackend(segmentId, { status });
      } catch (error) {
        console.error('Failed to update segment status:', error);
      }
    },
    [documentId, updateSegmentBackend]
  );



  // Split segment at cursor position
  const handleSplitSegment =async ()=> {
    if (!cursorPosition || !documentId) return;

    if (cursorPosition.segmentId === 'content-no-segments') {
      const offset = cursorPosition.offset;
      // IMPORTANT: Do not trim/strip. Preserve whitespace/newlines exactly.
      const textBefore = currentTextContent.substring(0, offset);
      const textAfter = currentTextContent.substring(offset);

      // Don't split if either part would be empty
      if (textBefore.length === 0 || textAfter.length === 0) {
        return;
      }

      // Create segments using bulk create (with optimistic updates)
      try {
        const createdSegments = await createSegmentsBulkBackend([
          {
            segment_index: 0,
            span_start: 0,
            span_end: offset,
            text: textBefore,
          },
          {
            segment_index: 1,
            span_start: offset,
            span_end: currentTextContent.length,
            text: textAfter,
          },
        ]);
        setCursorPosition(null);
        // Set the first created segment as active
        if (createdSegments && createdSegments.length > 0) {
          setSearchParams({ segmentId: createdSegments[0].id }, { replace: true });
        }
        return;
      } catch (error) {
        console.error('Failed to create segments:', error);
        // Error toast is handled by the mutation
        return;
      }
    }

    if (!activeSegmentId) return;

    const segment = currentSegments.find((seg) => seg.id === cursorPosition.segmentId);
    if (!segment) return;

    const textBefore = segment.text.substring(0, cursorPosition.offset);
    const textAfter = segment.text.substring(cursorPosition.offset);

    if (textBefore.length === 0 || textAfter.length === 0) {
      return;
    }

    try {
      await splitSegmentBackend(cursorPosition.segmentId, cursorPosition.offset);
      return;
    } catch (error) {
      console.error('Failed to split segment:', error);
      return;
    }
  }
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

      // Use backend merge
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
    },
    [currentSegments, documentId, mergeSegmentsBackend]
  );

  // Ref for AnnotationSidebar to access its methods
  const annotationSidebarRef = useRef<AnnotationSidebarRef>(null);

  // Handle bubble menu selection
  const handleBubbleMenuSelect = useCallback(
    (field: 'title' | 'author', segmentId: string, text: string) => {
      if (!segmentId || !text) return;

      // Store the pending value
      pendingBubbleMenuValueRef.current = { field, segmentId, text };
     
      // Activate the segment so sidebar shows it - update URL
      setSearchParams({ segmentId }, { replace: true });
      
      // If the segment is already active, apply immediately
      if (activeSegmentId === segmentId) {
        requestAnimationFrame(() => {
          if (field === 'title') {
            annotationSidebarRef.current?.setTitleValueWithoutUpdate(text);
          } else if (field === 'author') {
            annotationSidebarRef.current?.setAuthorValueWithoutUpdate(text);
          }
          pendingBubbleMenuValueRef.current = null;
        });
      }

      setBubbleMenuState(null);
    },
    [setSearchParams, activeSegmentId]
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

    try {
      // If no marker found, use AI API approach with React Query
      // Get the current selected segment text, or use currentTextContent if no segment is selected
      const activeSegment = activeSegmentId
        ? currentSegments.find((seg) => seg.id === activeSegmentId)
        : null;
      const contentToSend = activeSegment ? activeSegment.text : currentTextContent;

      // Use React Query mutation for AI detection
      const data = await aiTextEndings.detectTextEndings({
        content: contentToSend,
        document_id:documentId,
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

        // Note: Segment splitting should be handled by backend API
        // For now, this is a placeholder - backend should handle the split
        console.warn('AI detection on active segment requires backend support');
        
        // Set first new segment as active (if backend creates it)
        if (newSegmentsFromSegment.length > 0) {
          // Wait for backend to update, then set active segment
          // This will be handled by query invalidation
        }
      } else {
        // No active segment selected, apply to whole textContent
        // Note: This should be handled by backend API
        console.warn('AI detection requires backend support for creating segments');
      }
    } catch (error) {
      // Don't log error if it was aborted
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error detecting text endings:', error);
      }
    } finally {
      // Only reset abort controller if this request wasn't aborted
      if (!abortController.signal.aborted) {
        aiTextEndingAbortControllerRef.current = null;
      }
    }
  }, [currentTextContent, currentSegments, createSegmentsFromPositions, activeSegmentId, aiTextEndings, setSearchParams]);

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
    // Note: Undo functionality should be handled by backend
    // For now, this is a placeholder
    console.warn('Undo functionality requires backend support');
  }, []);

 
  // Show loading state if document is loading
  if (isLoadingDocument && !documentId) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
          <p className="text-sm text-gray-600">Loading document...</p>
        </div>
      </div>
    );
  }

  // Redirect to upload if no documentId
  if (!documentId) {
    navigate('/outliner');
    return null;
  }

  return (
    <OutlinerProvider
      value={{
        textContent: currentTextContent,
        segments: currentSegments,
        activeSegmentId,
        bubbleMenuState,
        cursorPosition,
        aiTextEndingLoading: aiTextEndings.isLoading,
        segmentLoadingStates: segmentLoadingStates || new Map(),
        onFileUpload: () => {},
        onFileUploadToBackend: undefined,
        isUploading: isLoadingDocument || isSaving,
        onTextSelection: handleTextSelection,
        onSegmentClick: handleSegmentClick,
        onCursorChange: handleCursorChange,
        onActivate: (segmentId: string) => setSearchParams({ segmentId }, { replace: true }),
        onInput: handleContentEditableInput,
        onKeyDown: handleContentEditableKeyDown,
        onAttachParent: handleAttachParent,
        onMergeWithPrevious: handleMergeWithPrevious,
        onBubbleMenuSelect: handleBubbleMenuSelect,
        onSplitSegment: handleSplitSegment,
        onAIDetectTextEndings: handleAIDetectTextEndings,
        onAITextEndingStop: handleAITextEndingStop,
        onUndoTextEndingDetection: handleUndoTextEndingDetection,
        onSegmentStatusUpdate: handleSegmentStatusUpdate,
        onResetSegments: resetSegmentsBackend,
      }}
    >
      <div className="flex flex-col bg-gray-50" style={{ height: 'calc(100vh - 4rem)' }}>
        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <AnnotationSidebar
            ref={annotationSidebarRef}
            activeSegment={activeSegment}
            documentId={documentId || undefined}
          />

          {/* Main Workspace */}
          <Workspace  />
        </div>
      </div>
    </OutlinerProvider>
  );
};

export default OutlinerWorkspace;
