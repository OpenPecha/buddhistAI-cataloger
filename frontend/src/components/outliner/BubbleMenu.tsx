import React, { useRef, useEffect } from 'react';
import Emitter from '@/events';
import type { BubbleMenuProps } from './types';

export const BubbleMenu: React.FC<BubbleMenuProps> = ({ position, onSelect, onClose, selectedText }) => {
  const menuRef = useRef<HTMLDivElement>(null);

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
        left: `${position.x}px`,
        top: `${position.y}px`,
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
