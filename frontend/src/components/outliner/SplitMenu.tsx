import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Scissors } from 'lucide-react';
import type { SplitMenuProps } from './types';

export const SplitMenu: React.FC<SplitMenuProps> = ({ position, segmentId, onSplit, onCancel, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [viewportPosition, setViewportPosition] = useState({ x: 0, y: 0 });

  // Convert relative position to viewport coordinates
  useEffect(() => {
    const segmentContainer = document.querySelector(
      `[data-segment-container-id="${segmentId}"]`
    ) as HTMLElement;

    if (segmentContainer) {
      const containerRect = segmentContainer.getBoundingClientRect();
      setViewportPosition({
        x: containerRect.left + position.x,
        y: containerRect.top + position.y,
      });
    } else {
      // Fallback: use position as-is (assumes it's already viewport coordinates)
      setViewportPosition(position);
    }
  }, [position, segmentId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const menuContent = (
    <div
      ref={menuRef}
      className="split-menu fixed z-[9999] bg-white rounded-lg shadow-lg border border-gray-200 p-2 min-w-[180px]"
      style={{
        left: `${viewportPosition.x}px`,
        top: `${viewportPosition.y}px`,
      }}
    >
      <button
        onClick={() => {
          onSplit();
          onClose();
        }}
        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded-md transition-colors flex items-center gap-2"
      >
        <Scissors className="w-4 h-4" />
        Split Here
      </button>
  
    </div>
  );

  return createPortal(menuContent, document.body);
};
