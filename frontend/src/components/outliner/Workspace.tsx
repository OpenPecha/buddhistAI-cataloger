import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { VariableSizeList } from 'react-window';
import type { ListChildComponentProps } from 'react-window';
import FileUploadZone from '@/components/textCreation/FileUploadZone';
import { OutlinerFileUploadZone } from './OutlinerFileUploadZone';
import { BubbleMenu } from './BubbleMenu';
import { SplitMenu } from './SplitMenu';
import { SegmentItem } from './SegmentItem';
import { WorkspaceHeader } from './WorkspaceHeader';
import { useOutliner } from './OutlinerContext';
import type { TextSegment, CursorPosition, BubbleMenuState } from './types';

// Row component data passed via itemData
interface RowData {
  segments: TextSegment[];
  activeSegmentId: string | null;
  previousDataLastSegmentId: string;
  cursorPosition: CursorPosition | null;
  bubbleMenuState: BubbleMenuState | null;
  segmentLoadingStates: Map<string, boolean>;
  onSplitSegment: () => void;
  onMergeWithPrevious: (segmentId: string) => void;
  onBubbleMenuSelect: (field: 'title' | 'author', segmentId: string, text: string) => void;
  setRowHeight: (index: number, height: number) => void;
}

// Row component props for VariableSizeList (react-window v1 API)
type RowProps = ListChildComponentProps<RowData>;

const Row: React.FC<RowProps> = ({ index, style, data }) => {
  const {
    segments,
    activeSegmentId,
    previousDataLastSegmentId,
    cursorPosition,
    bubbleMenuState,
    onSplitSegment,
    onMergeWithPrevious,
    onBubbleMenuSelect,
    setRowHeight,
  } = data as RowData;
  const segment = segments[index];
  const rowRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Measure and update row height
  const measureHeight = useCallback(() => {
    if (contentRef.current) {
      // Measure the actual content height including all children
      const height = contentRef.current.getBoundingClientRect().height;
      if (height > 0) {
        setRowHeight(index, height);
      }
    }
  }, [index, setRowHeight]);

  useEffect(() => {
    if (contentRef.current) {
      // Use ResizeObserver to watch for content changes
      const resizeObserver = new ResizeObserver(() => {
        // Use requestAnimationFrame to batch updates
        requestAnimationFrame(() => {
          measureHeight();
        });
      });
      
      resizeObserver.observe(contentRef.current);
      
      // Initial measurement - try multiple times to catch content that loads asynchronously
      const measureImmediately = () => {
        measureHeight();
      };
      
      // Measure immediately
      measureImmediately();
      
      // Also measure after a short delay to catch any async content
      const timeoutId1 = setTimeout(measureImmediately, 0);
      const timeoutId2 = setTimeout(measureImmediately, 50);
      
      return () => {
        clearTimeout(timeoutId1);
        clearTimeout(timeoutId2);
        resizeObserver.disconnect();
      };
    }
  }, [measureHeight, segment.id]);

  // Also measure when segment content changes
  useEffect(() => {
    // Measure immediately when content changes
    measureHeight();
    // Also measure after a delay to catch any layout changes
    const timeoutId = setTimeout(measureHeight, 0);
    return () => clearTimeout(timeoutId);
  }, [measureHeight, segment.text, segment.title, segment.author]);

  if (!segment) return null;

  const isFirstSegment = index === 0;
  const isAttached = isFirstSegment && segment.parentSegmentId !== undefined;
  const isActive = segment.id === activeSegmentId;

  // Ensure style includes width for proper layout
  const rowStyle: React.CSSProperties = {
    ...style,
    width: '100%',
  };

  return (
    <div style={rowStyle} ref={rowRef} className="px-6">
      <div ref={contentRef} className="relative">
        <SegmentItem
          segment={segment}
          segmentConfig={{
            index,
            isActive,
            isFirstSegment,
            isAttached,
            previousDataLastSegmentId,
          }}
          cursorPosition={cursorPosition}
        />

        {/* Split Menu - positioned relative to segment container */}
        {cursorPosition &&
          cursorPosition.segmentId === segment.id &&
          cursorPosition.menuPosition && (
            <SplitMenu
              position={cursorPosition.menuPosition}
              onSplit={onSplitSegment}
              onCancel={() => onMergeWithPrevious(segment.id)}
              onClose={() => {}}
            />
          )}

        {/* Bubble Menu - positioned relative to segment container */}
        {bubbleMenuState && bubbleMenuState.segmentId === segment.id && (
          <BubbleMenu
            position={bubbleMenuState.position}
            onSelect={(field) =>
              onBubbleMenuSelect(field, segment.id, bubbleMenuState.selectedText)
            }
            onClose={() => {}}
          />
        )}
      </div>
    </div>
  );
};

export const Workspace: React.FC = () => {
  const {
    textContent,
    segments,
    activeSegmentId,
    previousDataLastSegmentId,
    bubbleMenuState,
    cursorPosition,
    aiTextEndingLoading,
    previousSegments,
    segmentLoadingStates,
    workspaceRef,
    onFileUpload,
    onFileUploadToBackend,
    isUploading,
    onTextSelection,
    onBubbleMenuSelect,
    onSplitSegment,
    onMergeWithPrevious,
    onAIDetectTextEndings,
    onAITextEndingStop,
    onUndoTextEndingDetection,
    onLoadNewFile,
  } = useOutliner();

  const listRef = useRef<VariableSizeList>(null);
  const containerRef = useRef<HTMLElement>(null);
  const parentContainerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = React.useState(() => {
    // Initialize with a reasonable default
    if (globalThis.window !== undefined) {
      return globalThis.window.innerHeight - 150; // Approximate header + padding
    }
    return 600;
  });

  // Manual height cache
  const heightCache = useRef<Map<number, number>>(new Map());
  const DEFAULT_ROW_HEIGHT = 300; // Increased default to reduce initial overlap

  // Get row height from cache or default
  const getRowHeight = useCallback(
    (index: number) => {
      return heightCache.current.get(index) ?? DEFAULT_ROW_HEIGHT;
    },
    []
  );

  // Set row height and reset cache from that index
  const setRowHeight = useCallback(
    (index: number, height: number) => {
      const currentHeight = heightCache.current.get(index);
      // Always update if height is different (even by 1px) to prevent gaps
      if (currentHeight === undefined || currentHeight !== height) {
        heightCache.current.set(index, height);
        // Reset from this index to recalculate positions
        // Use true to force recalculation and prevent gaps
        listRef.current?.resetAfterIndex(index, true);
      }
    },
    []
  );

  // Track previous segments to detect splits/merges
  const previousSegmentsRef = useRef<TextSegment[]>([]);
  const previousSegmentsLengthRef = useRef<number>(0);
  
  // Reset height cache when segments change
  const segmentsKey = useMemo(() => segments.map((s) => s.id).join(','), [segments]);
  useEffect(() => {
    const previousSegments = previousSegmentsRef.current;
    const previousLength = previousSegmentsLengthRef.current;
    const currentSegments = segments;
    const currentLength = currentSegments.length;
    
    // Detect if this is a split (one segment became two) or merge (two became one)
    const wasSplit = previousLength < currentLength;
    const wasMerge = previousLength > currentLength;
    const segmentsChanged = segmentsKey !== previousSegments.map((s) => s.id).join(',');
    
    if (wasSplit || wasMerge || segmentsChanged) {
      // Clear height cache for affected indices
      if (wasSplit && previousSegments.length > 0) {
        // Find the index where the split likely occurred
        let splitIndex = -1;
        for (let i = 0; i < Math.min(previousSegments.length, currentSegments.length); i++) {
          if (previousSegments[i]?.id !== currentSegments[i]?.id) {
            splitIndex = i;
            break;
          }
        }
        
        // Clear cache for the split segment and following segments
        if (splitIndex >= 0) {
          // Clear from split index onwards
          for (let i = splitIndex; i < currentLength; i++) {
            heightCache.current.delete(i);
          }
          // Immediately reset from split index to recalculate all positions
          listRef.current?.resetAfterIndex(Math.max(0, splitIndex - 1), true);
        } else {
          // If we can't find the exact index, clear all and reset
          heightCache.current.clear();
          listRef.current?.resetAfterIndex(0, true);
        }
      } else {
        // For merges or other changes, clear all cache
        heightCache.current.clear();
        // Use double requestAnimationFrame to ensure DOM is updated
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            listRef.current?.resetAfterIndex(0, true);
          });
        });
      }
    }
    
    // Update refs
    previousSegmentsRef.current = [...currentSegments];
    previousSegmentsLengthRef.current = currentLength;
  }, [segmentsKey, segments]);

  // Calculate container height dynamically based on available space
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current && parentContainerRef.current) {
        // Measure the actual available height for the list
        const containerRect = containerRef.current.getBoundingClientRect();
        const newHeight = containerRect.height;
        
        // Only update if height actually changed significantly (more than 1px)
        setContainerHeight((prevHeight) => {
          if (newHeight > 0 && Math.abs(newHeight - prevHeight) > 1) {
            return newHeight;
          }
          return prevHeight;
        });
      }
    };

    // Initial measurement with a delay to ensure layout is settled
    const timeoutId = setTimeout(() => {
      requestAnimationFrame(updateHeight);
    }, 100);
    
    // Observe the container for size changes
    const resizeObserver = new ResizeObserver(() => {
      // Use requestAnimationFrame to ensure measurement happens after layout
      requestAnimationFrame(updateHeight);
    });
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    // Also observe parent container to catch header size changes
    if (parentContainerRef.current) {
      resizeObserver.observe(parentContainerRef.current);
    }

    // Also listen to window resize
    const handleResize = () => {
      requestAnimationFrame(updateHeight);
    };
    globalThis.window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      globalThis.window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Attach workspaceRef to the scrollable container
  useEffect(() => {
    if (listRef.current && workspaceRef) {
      // VariableSizeList exposes outerRef through the ref
      const listInstance = listRef.current as unknown as { outerRef?: { current: HTMLDivElement | null } };
      const scrollableElement = listInstance.outerRef?.current;
      if (scrollableElement) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (workspaceRef as any).current = scrollableElement;
      }
    }
  }, [workspaceRef, segments.length]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {textContent ? (
        <div ref={parentContainerRef} className="flex-1 flex flex-col overflow-hidden">
          {/* Workspace Header */}
          <WorkspaceHeader
            headerConfig={{
              segmentsCount: segments.length,
              aiTextEndingLoading,
              hasPreviousSegments: !!previousSegments,
            }}
            actions={{
              onAIDetectTextEndings,
              onAITextEndingStop,
              onUndoTextEndingDetection,
              onLoadNewFile,
            }}
          />

          {/* Text Display - Virtualized */}
          <section
            ref={containerRef}
            className="flex-1 bg-white relative overflow-hidden"
            onMouseUp={onTextSelection}
            style={{ minHeight: 0 }}
            aria-label="Text workspace content area"
          >
            {segments.length > 0 && containerHeight > 0 ? (
              <VariableSizeList
                ref={listRef}
                height={containerHeight}
                itemCount={segments.length}
                itemSize={getRowHeight}
                itemData={{
                  segments,
                  activeSegmentId,
                  previousDataLastSegmentId,
                  cursorPosition,
                  bubbleMenuState,
                  segmentLoadingStates,
                  onSplitSegment,
                  onMergeWithPrevious,
                  onBubbleMenuSelect,
                  setRowHeight,
                }}
                width="100%"
                className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
                overscanCount={3}
              >
                {Row}
              </VariableSizeList>
            ) : null}
          </section>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-12">
          <div className="w-full max-w-2xl">
            {onFileUploadToBackend ? (
              <OutlinerFileUploadZone
                onFileUpload={onFileUploadToBackend}
                isUploading={isUploading}
              />
            ) : (
              <FileUploadZone onFileUpload={onFileUpload} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
