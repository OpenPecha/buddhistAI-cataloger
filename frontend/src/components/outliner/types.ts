import type { Comment } from '@/api/outliner';

/** Segment label enum: FRONT_MATTER, TOC, TEXT, BACK_MATTER */
export type SegmentLabel = 'FRONT_MATTER' | 'TOC' | 'TEXT' | 'BACK_MATTER';

export interface TextSegment {
  id: string;
  text: string;
  title?: string;
  author?: string;
  title_bdrc_id?: string;
  author_bdrc_id?: string;
  parentSegmentId?: string;
  is_attached?: boolean | null;
  status?: string | null;
  label?: SegmentLabel | null;
  rejection_count?: number;
  is_supplied_title?: boolean | null;
  comments: Comment[];
}

export interface BubbleMenuProps {
  segmentId: string;
}

export interface SplitMenuProps {
  segmentId: string;
}

export interface SegmentTextContentProps {
  segmentId: string;
  text: string;
  title?: string;
  author?: string;
  onCursorChange: (segmentId: string, element: HTMLDivElement) => void;
  onActivate: () => void;
  onInput: (e: React.FormEvent<HTMLDivElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}

export interface BubbleMenuState {
  segmentId: string;
  position: { x: number; y: number };
  selectedText: string;
  selectionRange?: Range;
}

export interface CursorPosition {
  segmentId: string;
  offset: number;
  menuPosition?: { x: number; y: number };
}

export interface AISuggestions {
  title: string | null;
  suggested_title: string | null;
  author: string | null;
  suggested_author: string | null;
}
