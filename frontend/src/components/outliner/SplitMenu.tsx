import React, { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'
import { Scissors } from 'lucide-react'
import type { SplitMenuProps } from './types'
import { useMenuPosition } from './hooks/useMenuPosition'
import { useActions, useCursor } from './contexts'

export const SplitMenu: React.FC<SplitMenuProps> = ({ segmentId }) => {
  const { t } = useTranslation()
  const {onSplitSegment:onSplit}  =  useActions()
  const { cursorPosition, setCursorPosition } = useCursor()
  const position = cursorPosition?.menuPosition ?? { x: 0, y: 0 }
  const { viewportPosition, menuRef } = useMenuPosition({
    position,
    segmentId,
    menuWidth: 180,
    menuHeight: 50,
  })

  const showSplitMenu = cursorPosition?.segmentId === segmentId && cursorPosition.menuPosition

  // Close split UI by clearing cursor (only the segment that owns the cursor handles the event).
  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (cursorPosition?.segmentId !== segmentId) return
      const target = event.target as Node
      if (menuRef.current?.contains(target)) return
      const segmentEl = document.getElementById(segmentId)
      if (segmentEl?.contains(target)) return
      setCursorPosition(null)
    },
    [cursorPosition?.segmentId, segmentId, setCursorPosition, menuRef]
  )

  useEffect(() => {
    document.addEventListener('click', handleClickOutside, true)
    return () => {
      document.removeEventListener('click', handleClickOutside, true)
    }
  }, [handleClickOutside])

  if (!showSplitMenu) return null
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
        }}
        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded-md transition-colors flex items-center gap-2"
      >
        <Scissors className="w-4 h-4" />
        {t('outliner.splitMenu.splitHere')}
      </button>
    </div>
  )

  return createPortal(menuContent, document.body)
}
