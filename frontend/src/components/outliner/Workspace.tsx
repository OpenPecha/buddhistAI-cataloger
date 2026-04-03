import React, { useRef, useState, useCallback, useMemo, Activity } from 'react'
import {
  List,
  useDynamicRowHeight,
  type ListImperativeAPI,
  type RowComponentProps,
} from 'react-window'
import { SplitPane, Pane } from 'react-split-pane'
import { SegmentItemMemo as SegmentItem } from './SegmentItem'
import { WorkspaceHeader } from './WorkspaceHeader'
import { useDocument, useSelection, useActions } from './contexts'
import { useOutlinerDocument } from '@/hooks/useOutlinerDocument'
import type { TextSegment } from './types'
import ImageWrapper from './ImageWrapper'
import TocViewer from './TOCViewer'

export const Workspace: React.FC<{ listRef: React.RefObject<ListImperativeAPI | null> }> = ({
  listRef,
}) => {
  const { segments, aiTextEndingLoading } = useDocument()
  const { onTextSelection } = useSelection()
  const {
    onAIDetectTextEndings,
    onAITextEndingStop,
    onUndoTextEndingDetection,
    onResetSegments,
  } = useActions()
  const { isLoading: isLoadingDocument } = useOutlinerDocument()
  const containerRef = useRef<HTMLDivElement>(null)
  const parentContainerRef = useRef<HTMLDivElement>(null)
  const scrollPositionRef = useRef<number | null>(null)

  const rowHeight = useDynamicRowHeight({
    defaultRowHeight: 50,
  })

  const [tocPanelVisible, setTocPanelVisible] = useState(true)
  const toggleTocPanel = useCallback(() => {
    setTocPanelVisible((v) => !v)
  }, [])

  const hasTocSegment = useMemo(
    () => segments.some((segment) => segment.label === 'TOC'),
    [segments]
  )
  const showTocColumn = hasTocSegment && tocPanelVisible

  const [imageVisible, setImageVisible] = useState(false)

  const mainColumn = (
    <div
      ref={parentContainerRef}
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
    >
      <WorkspaceHeader
        headerConfig={{
          segmentsCount: segments.length,
          checkedSegmentsCount: segments.filter(
            (segment) => segment.status === 'checked' || segment.status === 'approved'
          ).length,
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
          hasTocSegment ? { visible: tocPanelVisible, onToggle: toggleTocPanel } : undefined
        }
      />
      {isLoadingDocument && (
        <div className="flex shrink-0 items-center justify-center py-12">
          <div className="text-center">
            <div className="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
            <p className="text-sm text-gray-600">Loading document...</p>
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-white scroll-container"
        onClick={onTextSelection}
        aria-label="Text workspace content area"
        role="section"
        onKeyDown={() => {}}
      >
        <Activity mode={segments.length > 0 ? 'visible' : 'hidden'}>
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
                const target = e.target as HTMLDivElement
                scrollPositionRef.current = target.scrollTop
              }}
            />
          </div>
        </Activity>
      </div>
    </div>
  )

  const bottomPane = showTocColumn ? (
    <SplitPane
      direction="horizontal"
      className="outliner-split-pane h-full min-h-0"
      dividerSize={8}
    >
      <Pane minSize={280}>{mainColumn}</Pane>
      <Pane defaultSize="30%" minSize={200} maxSize="50%">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <TocViewer />
        </div>
      </Pane>
    </SplitPane>
  ) : (
    mainColumn
  )

  const imagePanel = (
    <ImageWrapper imageVisible={imageVisible} onImageVisibleChange={setImageVisible} />
  )

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      {imageVisible ? (
        <SplitPane
          direction="vertical"
          className="outliner-split-pane flex-1 min-h-0"
          dividerSize={8}
        >
          <Pane defaultSize="32%" minSize={100} maxSize="70%">
            <div className="h-full min-h-0">{imagePanel}</div>
          </Pane>
          <Pane minSize={160}>{bottomPane}</Pane>
        </SplitPane>
      ) : (
        <div className="flex h-full min-h-0 flex-col">
          <div className="shrink-0">{imagePanel}</div>
          <div className="min-h-0 flex-1">{bottomPane}</div>
        </div>
      )}
    </div>
  )
}

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
