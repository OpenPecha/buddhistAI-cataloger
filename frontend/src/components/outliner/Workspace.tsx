import React, { useRef, useEffect, useCallback, Activity } from 'react';
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


export const Workspace: React.FC = () => {
  const {
    activeSegmentId,
    textContent,
    isUploading,
    segments,
    bubbleMenuState,
    cursorPosition,
    aiTextEndingLoading,
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
      setShouldRestoreScroll(true);
    }
    onSplitSegment();
  }, [onSplitSegment, setShouldRestoreScroll]);

  // Restore scroll position after segments update (split completes)
  useEffect(() => {
      // Use requestAnimationFrame to ensure DOM has updated
      setTimeout(() => {  
      if(activeSegmentId){
        const segmentElement = document.getElementById(activeSegmentId);
        if(segmentElement){
          segmentElement.scrollIntoView({ behavior: 'smooth' });
        }
      } 
      }, 100);
        
  }, [activeSegmentId]);

 

  


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
            onKeyDown={()=>{}}
          >
         <Activity mode={segments.length > 0?"visible":"hidden"}>
                <div className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                  {segments.map((segment, index) => {
                    return (
                      <div key={segment.id} className="px-6">
                        <div className="relative">
                          <SegmentItem
                            segment={segment}
                            index={index}
                            cursorPosition={cursorPosition}
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
                              onClose={()=>{}}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
            </Activity>
            <Activity mode={segments.length === 0 && textContent?"visible":"hidden"}>
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
                {cursorPosition?.segmentId === 'content-no-segments' &&
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
            </Activity>
          </div>
        </div>
   
    </div>
  );
};
