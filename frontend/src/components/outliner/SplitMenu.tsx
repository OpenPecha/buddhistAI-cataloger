import React, { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Scissors } from 'lucide-react'
import type { SplitMenuProps } from './types'
import { useMenuPosition } from './hooks/useMenuPosition'
import { useActions, useCursor } from './contexts'

export const SplitMenu: React.FC<SplitMenuProps> = ({ segmentId }) => {
  const {onSplitSegment:onSplit}  =  useActions()
  const { cursorPosition } = useCursor()
  const position=cursorPosition?.menuPosition??{x:0,y:0}
  const [isVisible, setIsVisible] = useState(false)
  const { viewportPosition, menuRef } = useMenuPosition({
    position,
    segmentId,
    menuWidth: 180,
    menuHeight: 50,
  })
  useEffect(() => {
    if(viewportPosition)  setIsVisible(true)
  }, [viewportPosition])
  // Handle outside click
  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (viewportPosition && menuRef.current && !menuRef.current.contains(event.target as Node)) {
      setIsVisible(false)
      }
    },
    [menuRef]
  )

  React.useEffect(() => {
    document.addEventListener('click', handleClickOutside, true)
    return () => {
      document.removeEventListener('click', handleClickOutside, true)
    }
  }, [handleClickOutside])

  const showSplitMenu = cursorPosition?.segmentId === segmentId && cursorPosition.menuPosition

 // Don't show if document.selection is not present
 if(!position||!isVisible || !showSplitMenu) return null;

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
          onSplit()
          setIsVisible(false)
        }}
        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded-md transition-colors flex items-center gap-2"
      >
        <Scissors className="w-4 h-4" />
        Split Here
      </button>
    </div>
  )

  return createPortal(menuContent, document.body)
}
