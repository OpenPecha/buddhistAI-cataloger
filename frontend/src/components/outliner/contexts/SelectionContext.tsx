import React, { createContext, useContext } from 'react'
import type { BubbleMenuState } from '../types'

interface SelectionContextValue {
  bubbleMenuState: BubbleMenuState | null
  setBubbleMenuState: (state: BubbleMenuState | null) => void
  onTextSelection: () => void
  onBubbleMenuSelect: (field: 'title' | 'author', segmentId: string, text: string) => void
}

const SelectionContext = createContext<SelectionContextValue | null>(null)

export function useSelection() {
  const context = useContext(SelectionContext)
  if (!context) {
    throw new Error('useSelection must be used within SelectionProvider')
  }
  return context
}

interface SelectionProviderProps {
  children: React.ReactNode
  value: SelectionContextValue
}

export function SelectionProvider({ children, value }: SelectionProviderProps) {
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>
}
