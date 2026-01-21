import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Scissors } from 'lucide-react';
import type { SplitMenuProps } from './types';

export const SplitMenu: React.FC<SplitMenuProps> = ({ position, segmentId, onSplit, onCancel, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [viewportPosition, setViewportPosition] = useState({ x: 0, y: 0 });

  // Convert relative position to viewport coordinates and adjust for viewport boundaries
  useEffect(() => {
    const segmentContainer = document.querySelector(
      `[data-segment-container-id="${segmentId}"]`
    ) as HTMLElement;

    if (segmentContainer) {
      const containerRect = segmentContainer.getBoundingClientRect();
      const menuWidth = 180; // Approximate menu width
      const menuHeight = 50; // Approximate menu height
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = 8;

      let x = containerRect.left + position.x;
      let y = containerRect.top + position.y;

      // Adjust horizontal position if menu would overflow
      if (x + menuWidth + margin > viewportWidth) {
        x = viewportWidth - menuWidth - margin;
      }
      if (x < margin) {
        x = margin;
      }

      // Adjust vertical position if menu would overflow
      if (y + menuHeight + margin > viewportHeight) {
        y = viewportHeight - menuHeight - margin;
      }
      if (y < margin) {
        y = margin;
      }

      setViewportPosition({ x, y });
    } else {
      // Fallback: use position as-is (assumes it's already viewport coordinates)
      setViewportPosition(position);
    }
  }, [position, segmentId]);

  // Fine-tune position after menu is rendered
  useEffect(() => {
    const adjustPosition = () => {
      if (menuRef.current) {
        const menuRect = menuRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const margin = 8;

        let finalX = menuRect.left;
        let finalY = menuRect.top;

        // Fine-tune horizontal position
        if (finalX + menuRect.width + margin > viewportWidth) {
          finalX = viewportWidth - menuRect.width - margin;
        }
        if (finalX < margin) {
          finalX = margin;
        }

        // Fine-tune vertical position
        if (finalY + menuRect.height + margin > viewportHeight) {
          finalY = viewportHeight - menuRect.height - margin;
        }
        if (finalY < margin) {
          finalY = margin;
        }

        if (finalX !== menuRect.left || finalY !== menuRect.top) {
          setViewportPosition({ x: finalX, y: finalY });
        }
      }
    };

    // Use requestAnimationFrame to ensure menu is rendered
    const rafId = requestAnimationFrame(() => {
      adjustPosition();
    });

    return () => cancelAnimationFrame(rafId);
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
