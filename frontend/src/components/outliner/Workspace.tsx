import React, { useRef, useEffect, useCallback } from 'react';
import { List, useDynamicRowHeight, type RowComponentProps } from "react-window";
import { useDebouncedState } from "@tanstack/react-pacer";

import { BubbleMenu } from './BubbleMenu';
import { SplitMenu } from './SplitMenu';
import { SegmentItemMemo as SegmentItem } from './SegmentItem';
import { WorkspaceHeader } from './WorkspaceHeader';
import { ContentDisplay } from './ContentDisplay';
import { useOutliner } from './OutlinerContext';
import type { TextSegment, CursorPosition, BubbleMenuState } from './types';

// Row component data passed via itemData
interface RowData {
  segments: TextSegment[];
  activeSegmentId: string | null;
  cursorPosition: CursorPosition | null;
  bubbleMenuState: BubbleMenuState | null;
  segmentLoadingStates: Map<string, boolean>;
  onSplitSegment: () => void;
  onMergeWithPrevious: (segmentId: string) => void;
  onBubbleMenuSelect: (field: 'title' | 'author', segmentId: string, text: string) => void;
  collapsedSegments: Set<string>;
  toggleSegmentCollapse: (segmentId: string) => void;
  toggleCollapseAll: () => void;
  isAllCollapsed: boolean;
}


const Row = ({ index, style, ...rowData }: RowComponentProps<RowData>) => {
  const {
    segments,
    activeSegmentId,
    cursorPosition,
    bubbleMenuState,
    onSplitSegment,
    onMergeWithPrevious,
    onBubbleMenuSelect,
    collapsedSegments,
    toggleSegmentCollapse,
    toggleCollapseAll,
    isAllCollapsed,
  } = rowData;
  const segment = segments[index];
  const rowRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const splitter = useCallback(() => {
    onSplitSegment();
  }, [onSplitSegment]);

  if (!segment) return null;

  const isFirstSegment = index === 0;
  const isAttached = isFirstSegment && (segment.is_attached ?? false);
  const isActive = segment.id === activeSegmentId;
  const isCollapsed = collapsedSegments.has(segment.id);

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
          }}
          cursorPosition={cursorPosition}
          isCollapsed={isCollapsed}
          onToggleCollapse={toggleSegmentCollapse}
          onCollapseAll={isFirstSegment ? toggleCollapseAll : undefined}
          isAllCollapsed={isFirstSegment ? isAllCollapsed : undefined}
        />

        {/* Split Menu - positioned relative to segment container */}
        {cursorPosition &&
          cursorPosition.segmentId === segment.id &&
          cursorPosition.menuPosition && (
            <SplitMenu
              position={cursorPosition.menuPosition}
              segmentId={segment.id}
              onSplit={splitter}
              onCancel={() => onMergeWithPrevious(segment.id)}
              onClose={() => {}}
            />
          )}

        {/* Bubble Menu - positioned relative to segment container */}
        {bubbleMenuState && bubbleMenuState.segmentId === segment.id && (
          <BubbleMenu
            position={bubbleMenuState.position}
            selectedText={bubbleMenuState.selectedText}
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
    isUploading,
    segments,
    activeSegmentId,
    bubbleMenuState,
    cursorPosition,
    aiTextEndingLoading,
    segmentLoadingStates,
    onTextSelection,
    onBubbleMenuSelect,
    onSplitSegment,
    onMergeWithPrevious,
    onAIDetectTextEndings,
    onAITextEndingStop,
    onUndoTextEndingDetection,
    onResetSegments,
    onCursorChange,
    onInput,
    onKeyDown,
  } = useOutliner();
  const containerRef = useRef<HTMLDivElement>(null);
  const parentContainerRef = useRef<HTMLDivElement>(null);
  
  // Manage collapsed state for all segments
  const [collapsedSegments, setCollapsedSegments] = React.useState<Set<string>>(new Set());
  
  // Initialize: all segments collapsed except active one
  React.useEffect(() => {
    if (segments.length > 0 && activeSegmentId) {
      const newCollapsed = new Set<string>();
      segments.forEach(segment => {
        if (segment.id !== activeSegmentId) {
          newCollapsed.add(segment.id);
        }
      });
      setCollapsedSegments(newCollapsed);
    }
  }, [segments, activeSegmentId]);
  
  // Update collapsed state when active segment changes
  React.useEffect(() => {
    if (activeSegmentId) {
      setCollapsedSegments(prev => {
        const newSet = new Set(prev);
        newSet.delete(activeSegmentId); // Expand active segment
        return newSet;
      });
    }
  }, [activeSegmentId]);
  
  const toggleSegmentCollapse = React.useCallback((segmentId: string) => {
    setCollapsedSegments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(segmentId)) {
        newSet.delete(segmentId);
      } else {
        newSet.add(segmentId);
      }
      return newSet;
    });
  }, []);
  
  const toggleCollapseAll = React.useCallback(() => {
    if (segments.length === 0) return;
    
    const allCollapsed = segments.every(seg => collapsedSegments.has(seg.id));
    
    if (allCollapsed) {
      // Expand all
      setCollapsedSegments(new Set());
    } else {
      // Collapse all except active
      const newCollapsed = new Set<string>();
      segments.forEach(segment => {
        if (segment.id !== activeSegmentId) {
          newCollapsed.add(segment.id);
        }
      });
      setCollapsedSegments(newCollapsed);
    }
  }, [segments, collapsedSegments, activeSegmentId]);
  
  const isAllCollapsed = segments.length > 0 && segments.every(seg => 
    seg.id === activeSegmentId ? false : collapsedSegments.has(seg.id)
  );
  const [containerHeight] = React.useState(() => {
    // Initialize with a reasonable default
    if (globalThis.window !== undefined) {
      return globalThis.window.innerHeight - 150; // Approximate header + padding
    }
    return 600;
  });
 
  const rowHeight = useDynamicRowHeight({
    defaultRowHeight: 50
  });

  // Save scroll position immediately when split happens, debounced value for restoration
  const scrollPositionRef = useRef<number | null>(null);
  const [shouldRestoreScroll, setShouldRestoreScroll] = useDebouncedState<boolean>(
    false,
    { wait: 100 }
  );
  // Track previous segments count to detect when split completes
  const prevSegmentsCountRef = useRef(segments.length);
  const segmentsCountChanged = prevSegmentsCountRef.current !== segments.length;

  // Save scroll position when split is triggered
  const handleSplitSegmentWithScrollSave = useCallback(() => {
    if (containerRef.current) {
      console.log('scroll position',scrollPositionRef.current);
      setShouldRestoreScroll(true);
    }
    onSplitSegment();
  }, [onSplitSegment, setShouldRestoreScroll]);

  // Restore scroll position after segments update (split completes)
  useEffect(() => {
      // Use requestAnimationFrame to ensure DOM has updated
      setTimeout(() => {  
        if (containerRef.current && scrollPositionRef.current !== null) {
          containerRef.current.scrollBy(0, scrollPositionRef.current);
          // Clear saved position after restoring
          scrollPositionRef.current = null;
          setShouldRestoreScroll(false);
        }
      }, 100);
        
    prevSegmentsCountRef.current = segments.length;
  }, [segments.length, segmentsCountChanged, shouldRestoreScroll, setShouldRestoreScroll]);

    const rowProps: RowData = {
    segments,
    activeSegmentId,
    cursorPosition,
    bubbleMenuState,
    segmentLoadingStates,
    onSplitSegment: handleSplitSegmentWithScrollSave,
    onMergeWithPrevious,
    onBubbleMenuSelect,
    collapsedSegments,
    toggleSegmentCollapse,
    toggleCollapseAll,
    isAllCollapsed,
  };

  


  if (isUploading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-white min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
          <span className="text-gray-500 text-lg">Loading, please wait...</span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
        <div ref={parentContainerRef} className="flex-1 flex flex-col overflow-hidden">
          {/* Workspace Header */}
          <WorkspaceHeader
            headerConfig={{
              segmentsCount: segments.length,
              aiTextEndingLoading,
              hasPreviousSegments: false,
            }}
            actions={{
              onAIDetectTextEndings,
              onAITextEndingStop,
              onUndoTextEndingDetection,
              onResetSegments,
            }}
          />

          {/* Text Display - Virtualized or Direct Rendering */}
          <div
            ref={containerRef}
            className="flex-1 bg-white relative overflow-auto scroll-container"
            onClick={onTextSelection}
            style={{ minHeight: 0 }}
            onScroll={(e) => {
              const target = e.target as HTMLDivElement;
              scrollPositionRef.current = target.scrollTop;
            }}
            aria-label="Text workspace content area"
            role="section"
          >
            {segments.length > 0 ? 
              // segments.length > 100 && containerHeight > 0 ? (
                // Use react-window for large lists (>100 segments)
                // <List
                //   rowComponent={Row as any}
                //   rowProps={rowProps}
                //   rowHeight={rowHeight}
                //   style={{ height: containerHeight }}
                //   rowCount={segments.length}
                //   className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
                //   overscanCount={5}

                //   />
              // ) : (
                // Direct rendering for smaller lists (<=100 segments)
                <div className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                  {segments.map((segment, index) => {
                    const isFirstSegment = index === 0;
                    const isAttached = isFirstSegment && (segment.is_attached ?? false);
                    const isActive = segment.id === activeSegmentId;
                    const isCollapsed = collapsedSegments.has(segment.id);
                    
                    return (
                      <div key={segment.id} className="px-6">
                        <div className="relative">
                          <SegmentItem
                            segment={segment}
                            segmentConfig={{
                              index,
                              isActive,
                              isFirstSegment,
                              isAttached,
                            }}
                            cursorPosition={cursorPosition}
                            isCollapsed={isCollapsed}
                            onToggleCollapse={toggleSegmentCollapse}
                            onCollapseAll={isFirstSegment ? toggleCollapseAll : undefined}
                            isAllCollapsed={isFirstSegment ? isAllCollapsed : undefined}
                          />

                          {/* Split Menu */}
                          {cursorPosition &&
                            cursorPosition.segmentId === segment.id &&
                            cursorPosition.menuPosition && (
                              <SplitMenu
                                position={cursorPosition.menuPosition}
                                segmentId={segment.id}
                                onSplit={handleSplitSegmentWithScrollSave}
                                onCancel={() => onMergeWithPrevious(segment.id)}
                                onClose={() => {}}
                              />
                            )}

                          {/* Bubble Menu */}
                          {bubbleMenuState && bubbleMenuState.segmentId === segment.id && (
                            <BubbleMenu
                              position={bubbleMenuState.position}
                              selectedText={bubbleMenuState.selectedText}
                              onSelect={(field) =>
                                onBubbleMenuSelect(field, segment.id, bubbleMenuState.selectedText)
                              }
                              onClose={() => {}}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              
             : segments.length === 0 && textContent ? (
              <div className="relative">
                <ContentDisplay
                  text={textContent}
                  onCursorChange={(element) => {
                    // Use the same cursor change handler with special segmentId
                    onCursorChange('content-no-segments', element);
                  }}
                  onInput={onInput}
                  onKeyDown={onKeyDown}
                />
                {/* Split Menu for content when no segments */}
                {cursorPosition &&
                  cursorPosition.segmentId === 'content-no-segments' &&
                  cursorPosition.menuPosition && (
                    <SplitMenu
                      position={cursorPosition.menuPosition}
                      segmentId="content-no-segments"
                      onSplit={handleSplitSegmentWithScrollSave}
                      onCancel={() => {}}
                      onClose={() => {}}
                    />
                  )}
              </div>
            ) : null}
          </div>
        </div>
   
    </div>
  );
};
