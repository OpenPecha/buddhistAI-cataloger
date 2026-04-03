import type { Comment } from '@/api/outliner'

/** Segment label enum: FRONT_MATTER, TOC, TEXT, BACK_MATTER */
export type SegmentLabel = 'FRONT_MATTER' | 'TOC' | 'TEXT' | 'BACK_MATTER'

export interface TextSegment {
  id: string
  text: string
  /** Character range in full document content (for BDRC matching, etc.) */
  span_start?: number
  span_end?: number
  title?: string
  author?: string
  /** Document-level offsets for title selected from source text */
  title_span_start?: number
  title_span_end?: number
  updated_title?: string
  author_span_start?: number
  author_span_end?: number
  updated_author?: string
  title_bdrc_id?: string
  author_bdrc_id?: string
  parentSegmentId?: string
  is_attached?: boolean | null
  status?: string | null
  label?: SegmentLabel | null
  rejection_count?: number
  is_supplied_title?: boolean | null
  comments: Comment[]
}

export interface BubbleMenuProps {
  segmentId: string
}

export interface SplitMenuProps {
  segmentId: string
}

export interface SegmentTextContentProps {
  segmentId: string
  text: string
  title?: string
  author?: string
  onCursorChange: (segmentId: string, element: HTMLDivElement) => void
  onActivate: () => void
  onInput: (e: React.FormEvent<HTMLDivElement>) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void
}

export interface BubbleMenuState {
  segmentId: string
  position: { x: number; y: number }
  selectedText: string
  selectionRange?: Range
  /** Start offset within segment plain text (matches cursor/split indexing; for BDRC page sync) */
  selectionStartOffset?: number
}

export interface CursorPosition {
  segmentId: string
  offset: number
  menuPosition?: { x: number; y: number }
}

export interface AISuggestions {
  title: string | null
  suggested_title: string | null
  author: string | null
  suggested_author: string | null
}

// Admin / API types
export interface Document {
  id: string
  content: string
  filename?: string | null
  user_id?: string | null
  total_segments: number
  annotated_segments: number
  /** Segments with status rejected (admin list API) */
  rejection_count?: number
  progress_percentage: number
  status?: string | null
  created_at: string
  updated_at: string
  /** Present on admin document detail responses */
  segments?: Segment[]
}

export interface Segment {
  id: string
  text: string
  segment_index: number
  span_start: number
  span_end: number
  title?: string | null
  author?: string | null
  title_span_start?: number | null
  title_span_end?: number | null
  updated_title?: string | null
  author_span_start?: number | null
  author_span_end?: number | null
  updated_author?: string | null
  title_bdrc_id?: string | null
  author_bdrc_id?: string | null
  parent_segment_id?: string | null
  is_annotated: boolean
  is_attached?: boolean | null
  status?: string | null
  rejection_count?: number
  comments?: Comment[]
  created_at: string
  updated_at: string
}

export interface DocumentStats {
  total: number
  active: number
  completed: number
  approved: number
  rejected: number
}
