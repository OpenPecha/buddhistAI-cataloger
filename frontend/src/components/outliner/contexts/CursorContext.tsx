import React, { createContext, useContext } from 'react'
import type { CursorPosition } from '../types'

interface CursorContextValue {
  cursorPosition: CursorPosition | null
  setCursorPosition: (position: CursorPosition | null) => void
  onCursorChange: (segmentId: string, element: HTMLDivElement) => void
}

const CursorContext = createContext<CursorContextValue | null>(null)

export function useCursor() {
  const context = useContext(CursorContext)
  if (!context) {
    throw new Error('useCursor must be used within CursorProvider')
  }
  return context
}

interface CursorProviderProps {
  children: React.ReactNode
  value: CursorContextValue
}

export function CursorProvider({ children, value }: CursorProviderProps) {
  return <CursorContext.Provider value={value}>{children}</CursorContext.Provider>
}
