import React, { useRef, useEffect } from 'react';
import type { SegmentTextContentProps } from './types';
import { renderTextWithMarkers } from './utils';

export const SegmentTextContent = React.forwardRef<HTMLDivElement, SegmentTextContentProps>(
  ({ segmentId, text, title, author, onCursorChange, onActivate, onInput, onKeyDown }, ref) => {
    const contentRef = useRef<HTMLDivElement>(null);

    // Combine refs
    useEffect(() => {
      if (typeof ref === 'function') {
        ref(contentRef.current);
      } else if (ref) {
        ref.current = contentRef.current;
      }
    }, [ref]);

    // Set HTML content when it changes
    useEffect(() => {
      if (contentRef.current) {
        const selection = globalThis.getSelection();
        const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
        const wasFocused = document.activeElement === contentRef.current;

        // Save cursor position
        let cursorOffset: number | null = null;
        if (wasFocused && range && contentRef.current.contains(range.commonAncestorContainer)) {
          const preRange = range.cloneRange();
          preRange.selectNodeContents(contentRef.current);
          preRange.setEnd(range.endContainer, range.endOffset);
          cursorOffset = preRange.toString().length;
        }

        // Render text with markers
        const html = renderTextWithMarkers(text, title, author);
        contentRef.current.innerHTML = html;

        // Restore cursor position if it was focused
        if (wasFocused && cursorOffset !== null) {
          const textContent = contentRef.current.textContent || '';
          const clampedOffset = Math.min(cursorOffset, textContent.length);

          // Find the text node and set cursor position
          const walker = document.createTreeWalker(
            contentRef.current,
            NodeFilter.SHOW_TEXT,
            null
          );

          let currentPos = 0;
          let targetNode: Node | null = null;
          let targetOffset = 0;

          let node: Node | null = walker.nextNode();
          while (node !== null) {
            const nodeLength = node.textContent?.length || 0;
            if (currentPos + nodeLength >= clampedOffset) {
              targetNode = node;
              targetOffset = clampedOffset - currentPos;
              break;
            }
            currentPos += nodeLength;
            node = walker.nextNode();
          }

          if (targetNode) {
            const newRange = document.createRange();
            newRange.setStart(targetNode, targetOffset);
            newRange.setEnd(targetNode, targetOffset);
            selection?.removeAllRanges();
            selection?.addRange(newRange);
          }
        }
      }
    }, [text, title, author]);

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
            onCursorChange(segmentId, contentRef.current);
          }
        }}
        onClick={() => {
          if (contentRef.current) {
            onCursorChange(segmentId, contentRef.current);
            onActivate();
          }
        }}
      />
    );
  }
);

SegmentTextContent.displayName = 'SegmentTextContent';
