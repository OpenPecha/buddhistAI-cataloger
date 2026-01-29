import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import Emitter from '@/events';
import type { BubbleMenuProps } from './types';
import { useMenuPosition } from './hooks/useMenuPosition';
import { useSelection } from './contexts';

const DEFAULT_POSITION = { x: 0, y: 0 };

export const BubbleMenu: React.FC<BubbleMenuProps> = ({ segmentId }) => {
  const [isVisible, setIsVisible] = useState(false);
  const { bubbleMenuState, onBubbleMenuSelect } = useSelection();
  
  // Memoize position by comparing actual values, not object reference
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const position = useMemo(() => {
    if (!bubbleMenuState?.position) return DEFAULT_POSITION;
    return bubbleMenuState.position;
  }, [bubbleMenuState?.position?.x, bubbleMenuState?.position?.y]);
  
  const selectedText = bubbleMenuState?.selectedText ?? '';
  
  // Track previous values to prevent unnecessary updates
  const prevValuesRef = useRef<{
    segmentId?: string;
    positionX?: number;
    positionY?: number;
  }>({});
  
  const { viewportPosition, menuRef } = useMenuPosition({
    position,
    segmentId,
    menuWidth: 150,
    menuHeight: 120,
  });

  const onSelect = (field: 'title' | 'author') => {
    onBubbleMenuSelect(field, segmentId, selectedText);
  };

  // Show menu when bubbleMenuState exists and matches this segment
  // Compare specific values to prevent infinite loops
  useEffect(() => {
    const currentSegmentId = bubbleMenuState?.segmentId;
    const currentPosition = bubbleMenuState?.position;
    const currentX = currentPosition?.x;
    const currentY = currentPosition?.y;
    
    const prev = prevValuesRef.current;
    
    // Only update if values actually changed
    const segmentIdChanged = prev.segmentId !== currentSegmentId;
    const positionChanged = prev.positionX !== currentX || prev.positionY !== currentY;
    
    if (segmentIdChanged || positionChanged) {
      const showBubbleMenu = currentSegmentId === segmentId && !!currentPosition;
      setIsVisible(showBubbleMenu);
      
      // Update ref with current values
      prevValuesRef.current = {
        segmentId: currentSegmentId,
        positionX: currentX,
        positionY: currentY,
      };
    }
  }, [
    bubbleMenuState?.segmentId,
    bubbleMenuState?.position?.x,
    bubbleMenuState?.position?.y,
    segmentId,
  ]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsVisible(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuRef]);

  const handleTitleSelect = () => {
    if (selectedText) {
      Emitter.emit('bubbleMenu:updateTitle', selectedText);
    }
    onSelect('title');
    setIsVisible(false)
  };

  const handleAuthorSelect = () => {
    if (selectedText) {
      Emitter.emit('bubbleMenu:updateAuthor', selectedText);
    }
    onSelect('author');
    setIsVisible(false)
  };

  const showBubbleMenu = bubbleMenuState?.segmentId === segmentId && !!bubbleMenuState?.position;
  
  if (!isVisible || !showBubbleMenu) return null;
  
  const menuContent = (
    <div
      ref={menuRef}
      className="bubble-menu fixed z-[9999] bg-white rounded-lg shadow-lg border border-gray-200 p-2 min-w-[150px]"
      style={{
        left: `${viewportPosition.x}px`,
        top: `${viewportPosition.y}px`,
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

  return createPortal(menuContent, document.body);
};
