import React, { useRef, useEffect, Activity } from 'react'
import { List, useDynamicRowHeight } from 'react-window'
import { SegmentItemMemo as SegmentItem } from './SegmentItem'
import { WorkspaceHeader } from './WorkspaceHeader'
import { useDocument, useSelection,  useActions } from './contexts'
import { useOutlinerDocument } from '@/hooks/useOutlinerDocument'
import type { TextSegment } from './types'

export const Workspace: React.FC = () => {
  const { activeSegmentId, segments, aiTextEndingLoading } = useDocument()
  const { onTextSelection } = useSelection()
  const {
    onAIDetectTextEndings,
    onAITextEndingStop,
    onUndoTextEndingDetection,
    onResetSegments,
  } = useActions()
  const { isLoading: isLoadingDocument } = useOutlinerDocument()
  const containerRef = useRef<HTMLDivElement>(null);
  const parentContainerRef = useRef<HTMLDivElement>(null);

  // Save scroll position immediately when split happens, debounced value for restoration
  const scrollPositionRef = useRef<number | null>(null);

  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM has updated
    setTimeout(() => {
      if (activeSegmentId) {
        const segmentElement = document.getElementById(activeSegmentId);
        if (segmentElement) {
          segmentElement.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }, 100);

  }, [activeSegmentId]);



  const rowHeight = useDynamicRowHeight({
    defaultRowHeight: 50
  });


 
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div ref={parentContainerRef} className="flex-1 flex flex-col overflow-hidden">
        {/* Workspace Header */}
        <WorkspaceHeader
          headerConfig={{
            segmentsCount: segments.length,
            checkedSegmentsCount: segments.filter((segment) => segment.status !== 'unchecked').length,
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
          {isLoadingDocument && (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
          <p className="text-sm text-gray-600">Loading document...</p>
        </div>
      </div>
    )
  }
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
          onKeyDown={() => { }}
        >
          <Activity mode={segments.length > 0 ? "visible" : "hidden"}>
            <div className="scrollbar-thin px-2 scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              <List
                rowComponent={RowComponent}
                rowCount={segments.length}
                rowHeight={rowHeight}
                rowProps={{ segments }}
              />
            </div>
          </Activity>
      
        </div>
      </div>

    </div>
  );
};



import { type RowComponentProps } from 'react-window'

function RowComponent({
  index,
  segments,
  style,
}: RowComponentProps<{
  segments: TextSegment[]
}>) {
  const segment = segments[index]
  return (
    <div style={style}>
      <SegmentItem segment={segment} index={index} />
    </div>
  )
}