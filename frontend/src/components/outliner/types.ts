import type { Comment } from '@/api/outliner';

export interface TextSegment {
  id: string;
  text: string;
  title?: string;
  author?: string;
  title_bdrc_id?: string;
  author_bdrc_id?: string;
  parentSegmentId?: string;
  is_attached?: boolean | null;
  status?: string | null; // checked, unchecked
  comments: Comment[]; // Updated to use comments array
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
