import React, { useRef, useEffect } from 'react';

interface ContentDisplayProps {
  text: string;
  onCursorChange: (element: HTMLDivElement) => void;
  onInput: (e: React.FormEvent<HTMLDivElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}

export const ContentDisplay: React.FC<ContentDisplayProps> = ({
  text,
  onCursorChange,
  onInput,
  onKeyDown,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

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

      // Render text (no markers for content display)
      contentRef.current.textContent = text;

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
  }, [text]);

  return (
    <div className="px-6 py-4">
      <div
        data-segment-container-id="content-no-segments"
        className="mb-4 p-4 rounded-lg border-2 border-gray-200 bg-gray-50"
      >
        <div
          ref={contentRef}
          data-segment-id="content-no-segments"
          className="segment-text-content text-gray-900 whitespace-pre-wrap wrap-break-word select-text relative outline-none"
          contentEditable
          suppressContentEditableWarning
          onInput={onInput}
          onKeyDown={onKeyDown}
          onSelect={() => {
            if (contentRef.current) {
              // Use setTimeout to ensure selection is available after click
              setTimeout(() => {
                if (contentRef.current) {
                  onCursorChange(contentRef.current);
                }
              }, 0);
            }
          }}
          onClick={(e) => {
            if (contentRef.current) {
              // Focus the element first to ensure selection can be created
              contentRef.current.focus();
              // Use setTimeout to ensure selection is available after click
              setTimeout(() => {
                if (contentRef.current) {
                  onCursorChange(contentRef.current);
                }
              }, 0);
            }
          }}
        />
      </div>
    </div>
  );
};
