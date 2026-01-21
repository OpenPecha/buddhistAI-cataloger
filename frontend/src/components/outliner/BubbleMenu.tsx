import React, { useRef, useEffect, useState } from 'react';
import Emitter from '@/events';
import type { BubbleMenuProps } from './types';

export const BubbleMenu: React.FC<BubbleMenuProps> = ({ position, onSelect, onClose, selectedText }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  // Adjust position to keep menu within viewport
  useEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const parentElement = menuRef.current.offsetParent as HTMLElement;
      
      if (parentElement) {
        const parentRect = parentElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const margin = 8;

        // Calculate current viewport position
        const currentViewportX = parentRect.left + position.x;
        const currentViewportY = parentRect.top + position.y;

        let adjustedX = position.x;
        let adjustedY = position.y;

        // Adjust horizontal position if menu would overflow
        if (currentViewportX + menuRect.width + margin > viewportWidth) {
          adjustedX = viewportWidth - parentRect.left - menuRect.width - margin;
        }
        if (currentViewportX < margin) {
          adjustedX = margin - parentRect.left;
        }

        // Adjust vertical position if menu would overflow
        if (currentViewportY + menuRect.height + margin > viewportHeight) {
          adjustedY = viewportHeight - parentRect.top - menuRect.height - margin;
        }
        if (currentViewportY < margin) {
          adjustedY = margin - parentRect.top;
        }

        setAdjustedPosition({ x: adjustedX, y: adjustedY });
      } else {
        setAdjustedPosition(position);
      }
    }
  }, [position]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleTitleSelect = () => {
    if (selectedText) {
      Emitter.emit('bubbleMenu:updateTitle', selectedText);
    }
    onSelect('title');
  };

  const handleAuthorSelect = () => {
    if (selectedText) {
      Emitter.emit('bubbleMenu:updateAuthor', selectedText);
    }
    onSelect('author');
  };

  return (
    <div
      ref={menuRef}
      className="absolute z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-2 min-w-[150px]"
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
      }}
    >
      <div className="text-xs text-gray-500 mb-2 px-2 py-1 border-b border-gray-200">
        Use selected text as:
      </div>
      <button
        onClick={handleTitleSelect}
        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded-md transition-colors"
      >
        📄 Title
      </button>
      <button
        onClick={handleAuthorSelect}
        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded-md transition-colors"
      >
        👤 Author
      </button>
    </div>
  );
};
