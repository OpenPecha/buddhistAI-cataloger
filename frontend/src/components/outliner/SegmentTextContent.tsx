import React, { useRef, useEffect } from 'react'
import type { SegmentTextContentProps } from './types'
import Highlighter from "react-highlight-words";
export const SegmentTextContent = React.forwardRef<HTMLDivElement, SegmentTextContentProps>(
  (
    {
      segmentId,
      text,
      title,
      author,
      segmentSearchQuery,
      onCursorChange,
      onActivate,
      onInput,
      onKeyDown,
    },
    ref
  ) => {
    const contentRef = useRef<HTMLDivElement>(null);

    const searchWords = segmentSearchQuery ? [segmentSearchQuery] : []
    return (
      <div
        ref={contentRef}
        data-segment-id={segmentId}
        className="segment-text-content cursor-text font-monlam text-gray-900 whitespace-pre-wrap wrap-break-word select-text relative outline-none"
        contentEditable
        suppressContentEditableWarning
        onInput={onInput}
        onKeyDown={onKeyDown}
        onSelect={() => {
          if (contentRef.current) {
            onCursorChange(segmentId, contentRef.current)
          }
        }}
        onClick={() => {
          if (contentRef.current) {
            onCursorChange(segmentId, contentRef.current)
            onActivate()
          }
        }}
      >
        <Highlighter
    highlightClassName="highlighter"
    searchWords={searchWords}
    autoEscape={true}
    textToHighlight={text}
  />
        </div>
    )
  }
)

SegmentTextContent.displayName = 'SegmentTextContent'
