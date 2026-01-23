export interface Document {
  id: string;
  content: string;
  filename?: string | null;
  user_id?: string | null;
  total_segments: number;
  annotated_segments: number;
  progress_percentage: number;
  status?: string | null;
  created_at: string;
  updated_at: string;
}

import type { Comment } from '@/api/outliner';

export interface Segment {
  id: string;
  text: string;
  segment_index: number;
  span_start: number;
  span_end: number;
  title?: string | null;
  author?: string | null;
  title_bdrc_id?: string | null;
  author_bdrc_id?: string | null;
  parent_segment_id?: string | null;
  is_annotated: boolean;
  is_attached?: boolean | null;
  status?: string | null;
  comments?: Comment[]; // Optional - comments are fetched separately
  created_at: string;
  updated_at: string;
}

export interface DocumentStats {
  total: number;
  active: number;
  completed: number;
  approved: number;
  rejected: number;
}