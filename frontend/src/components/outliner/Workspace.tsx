import React, { useRef, useState, useCallback, useMemo, Activity } from 'react'
import { List, useDynamicRowHeight,useListRef } from 'react-window'
import { SegmentItemMemo as SegmentItem } from './SegmentItem'
import { WorkspaceHeader } from './WorkspaceHeader'
import { useDocument, useSelection,  useActions } from './contexts'
import { useOutlinerDocument } from '@/hooks/useOutlinerDocument'
import type { TextSegment } from './types'
export const Workspace: React.FC<{ listRef: React.RefObject<List> }> = ({ listRef }) => {
  const {  segments, aiTextEndingLoading } = useDocument()
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



  const rowHeight = useDynamicRowHeight({
    defaultRowHeight: 50
  });

  const [tocPanelVisible, setTocPanelVisible] = useState(true)
  const toggleTocPanel = useCallback(() => {
    setTocPanelVisible((v) => !v)
  }, [])

  const hasTocSegment = useMemo(
    () => segments.some((segment) => segment.label === 'TOC'),
    [segments]
  )
  const showTocColumn = hasTocSegment && tocPanelVisible

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      <ImageWrapper />
      <div className="flex-1 flex min-h-0 min-w-0">
        <div
          ref={parentContainerRef}
          className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden"
        >
        {/* Workspace Header */}
        <WorkspaceHeader
          headerConfig={{
            segmentsCount: segments.length,
            checkedSegmentsCount: segments.filter((segment) => segment.status === 'checked' || segment.status === 'approved').length,
            rejectedSegmentsCount: segments.filter((segment) => segment.status === 'rejected').length,
            aiTextEndingLoading,
            hasPreviousSegments: false,
          }}
          actions={{
            onAIDetectTextEndings,
            onAITextEndingStop,
            onUndoTextEndingDetection,
            onResetSegments,
          }}
          tocPanel={
            hasTocSegment
              ? { visible: tocPanelVisible, onToggle: toggleTocPanel }
              : undefined
          }
        />
          {isLoadingDocument && (
            <div className="flex items-center justify-center py-12 shrink-0">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2" />
                <p className="text-sm text-gray-600">Loading document...</p>
              </div>
            </div>
          )}
        {/* Text Display - Virtualized or Direct Rendering */}

        

        <div
          ref={containerRef}
          className="relative flex flex-1 min-h-0 flex-col overflow-hidden bg-white scroll-container"
          onClick={onTextSelection}
          aria-label="Text workspace content area"
          role="section"
          onKeyDown={() => { }}
        >
          <Activity mode={segments.length > 0 ? "visible" : "hidden"}>
            <div className="flex min-h-0 flex-1 flex-col px-2">
              <List
              listRef={listRef}
                className="min-h-0 w-full scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 [scrollbar-gutter:stable]"
                style={{ height: '100%' }}
                rowComponent={RowComponent}
                rowCount={segments.length}
                rowHeight={rowHeight}
                rowProps={{ segments }}
                onScroll={(e) => {
                  const target = e.target as HTMLDivElement;
                  scrollPositionRef.current = target.scrollTop;
                }}
              />
            </div>
          </Activity>
        </div>
        </div>
        {showTocColumn ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <TocViewer />
          </div>
        ) : null}
      </div>
    </div>
  );
};



import { type RowComponentProps } from 'react-window'
import ImageWrapper from './ImageWrapper'
import TocViewer from './TOCViewer'

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
