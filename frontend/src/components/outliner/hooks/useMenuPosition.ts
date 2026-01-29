import { useState, useEffect, useRef } from 'react'

interface MenuPosition {
  x: number
  y: number
}

interface UseMenuPositionOptions {
  position: { x: number; y: number }
  segmentId: string
  menuWidth?: number
  menuHeight?: number
  margin?: number
}

export function useMenuPosition({
  position,
  segmentId,
  menuWidth = 150,
  menuHeight = 100,
  margin = 8,
}: UseMenuPositionOptions) {
  const [viewportPosition, setViewportPosition] = useState<MenuPosition>({ x: 0, y: 0 })
  const menuRef = useRef<HTMLDivElement>(null)
  const prevPositionRef = useRef<{ x: number; y: number } | null>(null)

  // Convert relative position to viewport coordinates and adjust for viewport boundaries
  useEffect(() => {
    // Only update if position values actually changed
    const positionChanged =
      prevPositionRef.current?.x !== position.x ||
      prevPositionRef.current?.y !== position.y

    if (!positionChanged && prevPositionRef.current !== null) {
      return
    }

    const segmentContainer = document.querySelector(
      `[data-segment-container-id="${segmentId}"]`
    ) as HTMLElement

    if (segmentContainer) {
      const containerRect = segmentContainer.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      let x = containerRect.left + position.x
      let y = containerRect.top + position.y

      // Adjust horizontal position if menu would overflow
      if (x + menuWidth + margin > viewportWidth) {
        x = viewportWidth - menuWidth - margin
      }
      if (x < margin) {
        x = margin
      }

      // Adjust vertical position if menu would overflow
      if (y + menuHeight + margin > viewportHeight) {
        y = viewportHeight - menuHeight - margin
      }
      if (y < margin) {
        y = margin
      }

      setViewportPosition({ x, y })
      prevPositionRef.current = { x: position.x, y: position.y }
    } else {
      // Fallback: use position as-is (assumes it's already viewport coordinates)
      setViewportPosition(position)
      prevPositionRef.current = { x: position.x, y: position.y }
    }
  }, [position.x, position.y, segmentId, menuWidth, menuHeight, margin])

  // Fine-tune position after menu is rendered
  // Only run when position or segmentId changes, not when viewportPosition changes
  useEffect(() => {
    if (!menuRef.current) return

    const adjustPosition = () => {
      if (menuRef.current) {
        const menuRect = menuRef.current.getBoundingClientRect()
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight

        let finalX = menuRect.left
        let finalY = menuRect.top

        // Fine-tune horizontal position
        if (finalX + menuRect.width + margin > viewportWidth) {
          finalX = viewportWidth - menuRect.width - margin
        }
        if (finalX < margin) {
          finalX = margin
        }

        // Fine-tune vertical position
        if (finalY + menuRect.height + margin > viewportHeight) {
          finalY = viewportHeight - menuRect.height - margin
        }
        if (finalY < margin) {
          finalY = margin
        }

        // Use functional update to compare with current state
        setViewportPosition((prev) => {
          if (finalX === prev.x && finalY === prev.y) {
            return prev // Return same reference if unchanged
          }
          return { x: finalX, y: finalY }
        })
      }
    }

    // Use requestAnimationFrame to ensure menu is rendered
    const rafId = requestAnimationFrame(() => {
      adjustPosition()
    })

    return () => cancelAnimationFrame(rafId)
  }, [position.x, position.y, segmentId, margin])

  return { viewportPosition, menuRef }
}
