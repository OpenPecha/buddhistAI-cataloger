import React, { createContext, useContext } from 'react'

interface ActionsContextValue {
  onFileUpload: (content: string) => void
  onFileUploadToBackend?: (file: File) => Promise<void>
  onSegmentClick: (segmentId: string, event?: React.MouseEvent) => void
  onActivate: (segmentId: string) => void
  onInput: (e: React.FormEvent<HTMLDivElement>) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void
  onAttachParent: () => void
  onMergeWithPrevious: (segmentId: string) => void
  onSplitSegment: () => void
  onAIDetectTextEndings: () => void
  onAITextEndingStop: () => void
  onUndoTextEndingDetection: () => void
  onLoadNewFile: () => void
  onSegmentStatusUpdate?: (segmentId: string, status: 'checked' | 'unchecked') => Promise<void>
  onResetSegments?: () => void
}

const ActionsContext = createContext<ActionsContextValue | null>(null)

export function useActions() {
  const context = useContext(ActionsContext)
  if (!context) {
    throw new Error('useActions must be used within ActionsProvider')
  }
  return context
}

interface ActionsProviderProps {
  children: React.ReactNode
  value: ActionsContextValue
}

export function ActionsProvider({ children, value }: ActionsProviderProps) {
  return <ActionsContext.Provider value={value}>{children}</ActionsContext.Provider>
}
