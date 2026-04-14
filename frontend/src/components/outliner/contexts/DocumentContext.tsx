import React, { createContext, useContext } from 'react'
import type { TextSegment } from '../types'

interface DocumentContextValue {
  textContent: string
  segments: TextSegment[]
  activeSegmentId: string | null
  /** Current Title field value in the sidebar for the active segment (may differ from saved segment.title until Save). */
  sidebarTitleDraft: string
  /** In-segment text search query for the active segment (sidebar Metadata tab + workspace highlights). */
  activeSegmentSearchQuery: string
  setActiveSegmentSearchQuery: (query: string) => void
  aiTextEndingLoading: boolean
  segmentLoadingStates: Map<string, boolean>
  isUploading?: boolean
}

const DocumentContext = createContext<DocumentContextValue | null>(null)

export function useDocument() {
  const context = useContext(DocumentContext)
  if (!context) {
    throw new Error('useDocument must be used within DocumentProvider')
  }
  return context
}

interface DocumentProviderProps {
  children: React.ReactNode
  value: DocumentContextValue
}

export function DocumentProvider({ children, value }: DocumentProviderProps) {
  return <DocumentContext.Provider value={value}>{children}</DocumentContext.Provider>
}
