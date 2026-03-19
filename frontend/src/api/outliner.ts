import { API_URL } from '@/config/api';
import type { TextSegment } from '@/features/outliner/types';

// ==================== Types ====================

export type OutlineDocumentStatus ='completed' | 'active' | 'rejected' | 'approved'|'deleted';
export type OutlineSegmentStatus="checked"|"unchecked"|"approved"|"rejected";
export interface OutlinerDocument {
  id: string;
  content: string;
  filename?: string | null;
  user_id?: string | null;
  total_segments: number;
  annotated_segments: number;
  progress_percentage: number;
  created_at: string;
  updated_at: string;
  segments?: OutlinerSegment[];
}

export interface OutlinerDocumentListItem {
  id: string;
  filename?: string | null;
  user_id?: string | null;
  total_segments: number;
  annotated_segments: number;
  progress_percentage: number;
  checked_segments: number;
  unchecked_segments: number;
  status?: OutlineDocumentStatus | null;
  created_at: string;
  updated_at: string;
}

export type SegmentLabel = 'FRONT_MATTER' | 'TOC' | 'TEXT' | 'BACK_MATTER';

export interface OutlinerSegment {
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
  status?: OutlineSegmentStatus | null;
  label?: SegmentLabel | null;
  rejection_count?: number;
  is_supplied_title?: boolean | null;
  created_at: string;
  updated_at: string;
  comments: Comment[];
}

export interface DocumentCreateRequest {
  content: string;
  filename?: string;
  user_id?: string;
}

export interface SegmentCreateRequest {
  text?: string; // Optional - backend will extract from document if not provided
  segment_index: number;
  span_start: number;
  span_end: number;
  title?: string;
  author?: string;
  title_bdrc_id?: string;
  author_bdrc_id?: string;
  parent_segment_id?: string;
}

export interface Comment {
  content: string;
  username: string;
  timestamp: string;
}

export interface CommentsData {
  comments: Comment[];
}

export interface SegmentUpdateRequest {
  text?: string;
  title?: string;
  author?: string;
  title_bdrc_id?: string;
  author_bdrc_id?: string;
  parent_segment_id?: string;
  is_attached?: boolean;
  status?: OutlineSegmentStatus; // checked, unchecked
  label?: SegmentLabel; // FRONT_MATTER, TOC, TEXT, BACK_MATTER
  comment?: string | CommentsData | Comment[]; // Can be old string format, CommentsData format, or array format
  comment_content?: string; // New comment content to append
  comment_username?: string; // Username for new comment
  is_supplied_title?: boolean; // Title supplied by annotator (not from source)
}

export interface BulkSegmentUpdateRequest {
  segments: SegmentUpdateRequest[];
  segment_ids: string[];
}

export interface BulkSegmentOperationsRequest {
  create?: SegmentCreateRequest[];
  update?: Array<{ id: string } & Partial<SegmentUpdateRequest & { span_start?: number; span_end?: number; segment_index?: number }>>;
  delete?: string[];
}

export interface SplitSegmentRequest {
  segment_id: string;
  split_position: number;
}

export interface MergeSegmentsRequest {
  segment_ids: string[];
}

export interface DocumentProgress {
  document_id: string;
  total_segments: number;
  annotated_segments: number;
  checked_segments: number;
  unchecked_segments: number;
  progress_percentage: number;
  updated_at: string;
}

// ==================== Helper Functions ====================

const handleApiResponse = async (response: Response): Promise<any> => {
  if (!response.ok) {
    const contentType = response.headers.get('content-type');
    let errorMessage = 'An error occurred';

    if (contentType && contentType.includes('application/json')) {
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        // Ignore JSON parse errors
      }
    }

    throw new Error(errorMessage);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await response.json();
  }
  return null;
};

// ==================== Document Endpoints ====================

export const createOutlinerDocument = async (
  data: DocumentCreateRequest
): Promise<OutlinerDocument> => {
  const response = await fetch(`${API_URL}/outliner/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  return handleApiResponse(response);
};





export const getOutlinerDocument = async (
  documentId: string,
  includeSegments: boolean = true
): Promise<OutlinerDocument> => {
  const url = `${API_URL}/outliner/documents/${documentId}?include_segments=${includeSegments}`;
  const response = await fetch(url);
  return handleApiResponse(response);
};

export const listOutlinerDocuments = async (
  user_id?: string,
  skip: number = 0,
  limit: number = 100,
  include_deleted: boolean = false
): Promise<OutlinerDocumentListItem[]> => {
  const params = new URLSearchParams();
  if (user_id) params.append('user_id', user_id);
  params.append('skip', skip.toString());
  params.append('limit', limit.toString());
  params.append('include_deleted', include_deleted.toString());

  const response = await fetch(`${API_URL}/outliner/documents?${params.toString()}`);
  return handleApiResponse(response);
};

export const updateOutlinerDocumentContent = async (
  documentId: string,
  content: string
): Promise<{ message: string; document_id: string }> => {
  const response = await fetch(`${API_URL}/outliner/documents/${documentId}/content`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });

  return handleApiResponse(response);
};

export const deleteOutlinerDocument = async (documentId: string): Promise<void> => {
  const response = await fetch(`${API_URL}/outliner/documents/${documentId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    await handleApiResponse(response);
  }
};

export const getDocumentProgress = async (
  documentId: string
): Promise<DocumentProgress> => {
  const response = await fetch(`${API_URL}/outliner/documents/${documentId}/progress`);
  return handleApiResponse(response);
};

// ==================== Segment Endpoints ====================

export const createSegment = async (
  documentId: string,
  segment: SegmentCreateRequest
): Promise<OutlinerSegment> => {
  const response = await fetch(`${API_URL}/outliner/documents/${documentId}/segments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(segment),
  });

  return handleApiResponse(response);
};

export const createSegmentsBulk = async (
  documentId: string,
  segments: SegmentCreateRequest[]
): Promise<OutlinerSegment[]> => {
  const response = await fetch(`${API_URL}/outliner/documents/${documentId}/segments/bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(segments),
  });

  return handleApiResponse(response);
};

export const getSegments = async (documentId: string): Promise<OutlinerSegment[]> => {
  const response = await fetch(`${API_URL}/outliner/documents/${documentId}/segments`);
  return handleApiResponse(response);
};

export const getSegment = async (segmentId: string): Promise<OutlinerSegment> => {
  const response = await fetch(`${API_URL}/outliner/segments/${segmentId}`);
  return handleApiResponse(response);
};

export const updateSegment = async (
  segmentId: string,
  updates: SegmentUpdateRequest
): Promise<OutlinerSegment> => {
  const response = await fetch(`${API_URL}/outliner/segments/${segmentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  return handleApiResponse(response);
};

export const updateSegmentsBulk = async (
  updates: BulkSegmentUpdateRequest
): Promise<OutlinerSegment[]> => {
  const response = await fetch(`${API_URL}/outliner/segments/bulk`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  return handleApiResponse(response);
};

export const splitSegment = async (
  segmentId: string,
  splitPosition: number,
  documentId?: string
): Promise<OutlinerSegment[]> => {
  const response = await fetch(`${API_URL}/outliner/segments/${segmentId}/split`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      segment_id: segmentId,
      split_position: splitPosition,
      document_id: documentId,
    }),
  });

  return handleApiResponse(response);
};

export const mergeSegments = async (
  segmentIds: string[]
): Promise<OutlinerSegment> => {
  const response = await fetch(`${API_URL}/outliner/segments/merge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ segment_ids: segmentIds }),
  });

  return handleApiResponse(response);
};

export const deleteSegment = async (segmentId: string): Promise<void> => {
  const response = await fetch(`${API_URL}/outliner/segments/${segmentId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    await handleApiResponse(response);
  }
};

// ==================== Comment Endpoints ====================

export interface CommentCreateRequest {
  content: string;
  username: string;
}

export interface CommentUpdateRequest {
  content: string;
}

export const getSegmentComments = async (segmentId: string): Promise<Comment[]> => {
  const response = await fetch(`${API_URL}/outliner/segments/${segmentId}/comment`);
  return handleApiResponse(response);
};

export const addSegmentComment = async (
  segmentId: string,
  comment: CommentCreateRequest
): Promise<Comment[]> => {
  const response = await fetch(`${API_URL}/outliner/segments/${segmentId}/comment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(comment),
  });

  return handleApiResponse(response);
};

export const updateSegmentComment = async (
  segmentId: string,
  commentIndex: number,
  comment: CommentUpdateRequest
): Promise<Comment[]> => {
  const response = await fetch(`${API_URL}/outliner/segments/${segmentId}/comment/${commentIndex}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(comment),
  });

  return handleApiResponse(response);
};

export const deleteSegmentComment = async (
  segmentId: string,
  commentIndex: number
): Promise<Comment[]> => {
  const response = await fetch(`${API_URL}/outliner/segments/${segmentId}/comment/${commentIndex}`, {
    method: 'DELETE',
  });

  return handleApiResponse(response);
};

export const assignVolume = async (user_id: string): Promise<OutlinerDocument> => {
  const params = new URLSearchParams();
  params.append('user_id', user_id);
  
  const response = await fetch(`${API_URL}/outliner/assign_volume?${params.toString()}`, {
    method: 'POST',
  });

  return handleApiResponse(response);
};


export const updateDocumentStatus = async (
  documentId: string,
  status: string,
  user_id?: string
): Promise<{ message: string; document_id: string; status: string }> => {
  const params = new URLSearchParams();
  if (user_id) params.append('user_id', user_id);
  
  const url = `${API_URL}/outliner/documents/${documentId}/status${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });

  return handleApiResponse(response);
};

export const rejectSegment = async (
  segmentId: string,
  reviewerId?: string
): Promise<OutlinerSegment> => {
  const params = new URLSearchParams();
  if (reviewerId) params.append('reviewer_id', reviewerId);
  const qs = params.toString();
  const url = `${API_URL}/outliner/segments/${segmentId}/reject${qs ? `?${qs}` : ''}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
  });
  return handleApiResponse(response);
};

export const rejectSegmentsBulk = async (
  segmentIds: string[],
  reviewerId?: string
): Promise<OutlinerSegment[]> => {
  const response = await fetch(`${API_URL}/outliner/segments/bulk-reject`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ segment_ids: segmentIds, reviewer_id: reviewerId }),
  });
  return handleApiResponse(response);
};

export const updateSegmentStatus = async (
  segmentId: string,
  status: 'checked' | 'unchecked' | 'approved' | 'rejected'
): Promise<{ message: string; segment_id: string; status: string }> => {
  const response = await fetch(`${API_URL}/outliner/segments/${segmentId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });

  return handleApiResponse(response);
};

export const bulkSegmentOperations = async (
  documentId: string,
  operations: BulkSegmentOperationsRequest
): Promise<OutlinerSegment[]> => {
  const response = await fetch(`${API_URL}/outliner/documents/${documentId}/segments/bulk-operations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(operations),
  });

  return handleApiResponse(response);
};

export const resetSegments = async (documentId: string): Promise<void> => {
  const response = await fetch(`${API_URL}/outliner/documents/${documentId}/segments/reset`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    await handleApiResponse(response);
  }
};

// ==================== Dashboard Stats ====================

export interface DashboardStats {
  document_count: number;
  total_segments: number;
  segments_with_title_or_author: number;
  rejection_count: number;
}

export const getDashboardStats = async (
  user_id?: string,
  start_date?: string,
  end_date?: string,
): Promise<DashboardStats> => {
  const params = new URLSearchParams();
  if (user_id) params.append('user_id', user_id);
  if (start_date) params.append('start_date', start_date);
  if (end_date) params.append('end_date', end_date);
  const qs = params.toString();
  const response = await fetch(`${API_URL}/outliner/dashboard/stats${qs ? `?${qs}` : ''}`);
  return handleApiResponse(response);
};

// ==================== AI Endpoints ====================

export interface DetectTextEndingsRequest {
  document_id: string;
  content: string;
  segment_id: string;
}

export interface DetectTextEndingsResponse {
  message: string;
  segments_created: number;
  segment_ids: string[];
}

export const detectTextEndings = async (
  request: DetectTextEndingsRequest,
  signal?: AbortSignal
): Promise<DetectTextEndingsResponse> => {
  const response = await fetch(`${API_URL}/ai/detect-text-endings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(request),
    signal,
  });

  return handleApiResponse(response);
};

export interface GenerateTitleAuthorRequest {
  content: string;
}

export interface GenerateTitleAuthorResponse {
  title?: string;
  suggested_title?: string;
  author?: string;
  suggested_author?: string;
}

export const generateTitleAuthor = async (
  request: GenerateTitleAuthorRequest,
  signal?: AbortSignal
): Promise<GenerateTitleAuthorResponse> => {
  const response = await fetch(`${API_URL}/ai/generate-title-author`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(request),
    signal,
  });

  return handleApiResponse(response);
};

// ==================== Utility Functions ====================

/**
 * Convert OutlinerSegment to TextSegment format used in frontend
 */
export const outlinerSegmentToTextSegment = (segment: OutlinerSegment): TextSegment => {
  return {
    id: segment.id,
    text: segment.text,
    title: segment.title || undefined,
    author: segment.author || undefined,
    title_bdrc_id: segment.title_bdrc_id || undefined,
    author_bdrc_id: segment.author_bdrc_id || undefined,
    parentSegmentId: segment.parent_segment_id || undefined,
    is_attached: segment.is_attached ?? undefined,
    status: segment.status || undefined,
    label: segment.label ?? undefined,
    rejection_count: segment.rejection_count ?? 0,
    is_supplied_title: segment.is_supplied_title ?? undefined,
    comments: segment.comments,
  };
};

/**
 * Convert TextSegment to OutlinerSegment format for API
 * Note: text is not included - backend will extract it from document using span addresses
 */
export const textSegmentToOutlinerSegment = (
  segment: TextSegment,
  _documentId: string,
  index: number,
  spanStart: number,
  spanEnd: number
): SegmentCreateRequest => {
  return {
    // text is omitted - backend extracts from document content using span_start/span_end
    segment_index: index,
    span_start: spanStart,
    span_end: spanEnd,
    title: segment.title,
    author: segment.author,
    title_bdrc_id: segment.title_bdrc_id,
    author_bdrc_id: segment.author_bdrc_id,
    parent_segment_id: segment.parentSegmentId,
  };
};
