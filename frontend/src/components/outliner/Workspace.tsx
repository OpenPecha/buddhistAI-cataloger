import React, { useRef } from 'react';
import { List, useDynamicRowHeight, type RowComponentProps } from "react-window";

import FileUploadZone from '@/components/textCreation/FileUploadZone';
import { OutlinerFileUploadZone } from './OutlinerFileUploadZone';
import { BubbleMenu } from './BubbleMenu';
import { SplitMenu } from './SplitMenu';
import { SegmentItem } from './SegmentItem';
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
  } = rowData;
  const segment = segments[index];
  const rowRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

 


  if (!segment) return null;

  const isFirstSegment = index === 0;
  const isAttached = isFirstSegment && (segment.is_attached ?? false);
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
          }}
          cursorPosition={cursorPosition}
        />

        {/* Split Menu - positioned relative to segment container */}
        {cursorPosition &&
          cursorPosition.segmentId === segment.id &&
          cursorPosition.menuPosition && (
            <SplitMenu
              position={cursorPosition.menuPosition}
              segmentId={segment.id}
              onSplit={onSplitSegment}
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
    segments,
    activeSegmentId,
    bubbleMenuState,
    cursorPosition,
    aiTextEndingLoading,
    segmentLoadingStates,
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
    onResetSegments,
    onCursorChange,
    onInput,
    onKeyDown,
  } = useOutliner();

  const containerRef = useRef<HTMLDivElement>(null);
  const parentContainerRef = useRef<HTMLDivElement>(null);
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

    const rowProps: RowData = {
    segments,
    activeSegmentId,
    cursorPosition,
    bubbleMenuState,
    segmentLoadingStates,
    onSplitSegment,
    onMergeWithPrevious,
    onBubbleMenuSelect,
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {textContent ? (
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
              onLoadNewFile,
              onResetSegments,
            }}
          />

          {/* Text Display - Virtualized */}
          <div
            ref={containerRef}
            className="flex-1 bg-white relative overflow-auto"
            onClick={onTextSelection}
            style={{ minHeight: 0 }}
            aria-label="Text workspace content area"
            role="section"
          >
            {segments.length > 0 && containerHeight > 0 ? (
              <List
                rowComponent={Row as any}
                rowProps={rowProps}
                rowHeight={rowHeight}
                height={containerHeight}
                rowCount={segments.length}
                width="100%"
                className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
                overscanCount={3}
              />
            ) : segments.length === 0 && textContent ? (
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
                      onSplit={onSplitSegment}
                      onCancel={() => {}}
                      onClose={() => {}}
                    />
                  )}
              </div>
            ) : null}
          </div>
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
