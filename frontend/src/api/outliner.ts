import { API_URL, OUTLINER_V1_URL } from '@/config/api';
import type { TextSegment } from '@/features/outliner/types';
import { segmentBodyFromDocument, withResolvedSegmentTexts } from '@/lib/outlinerSegmentText';

// ==================== Types ====================

export type OutlineDocumentStatus =
  | 'completed'
  | 'active'
  | 'rejected'
  | 'approved'
  | 'deleted'
  | 'skipped';
export type OutlineSegmentStatus="checked"|"unchecked"|"approved"|"rejected";
export interface OutlinerDocument {
  id: string;
  status?:OutlineDocumentStatus;
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

/** GET …/documents/:id/toc (AI / stored TOC entries) */
export interface AiTocEntryItem {
  page_no: number;
  title: string;
}

export interface OutlinerDocumentAiTocEntries {
  entries: AiTocEntryItem[];
}

/** Latest rejection on the document (any segment), from GET …/documents. */
export interface RejectedSegmentListNotice {
  message: string;
  document_id: string;
  segment_id: string;
  reviewer_user: { name?: string | null; picture?: string | null } | null;
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
  /** Most recent reviewer rejection in this document; use for annotator notices. */
  rejected_segment?: RejectedSegmentListNotice | null;
}

export type SegmentLabel = 'FRONT_MATTER' | 'TOC' | 'TEXT' | 'BACK_MATTER';

/** Latest reviewer on a segment rejection (from users table). */
export interface SegmentRejectionReviewer {
  user_id: string;
  name?: string | null;
  picture?: string | null;
}

/** Bundled rejection info on segment payloads (document GET + segment CRUD). */
export interface SegmentRejection {
  count: number;
  reason?: string | null;
  reviewer?: SegmentRejectionReviewer | null;
  /** True after annotator saves the segment while it was rejected (latest rejection row). */
  resolved?: boolean | null;
}

export interface OutlinerSegment {
  id: string;
  /** Resolved client-side from document.content + spans when omitted by API */
  text?: string;
  segment_index: number;
  span_start: number;
  span_end: number;
  title?: string | null;
  author?: string | null;
  title_span_start?: number | null;
  title_span_end?: number | null;
  updated_title?: string | null;
  author_span_start?: number | null;
  author_span_end?: number | null;
  updated_author?: string | null;
  title_bdrc_id?: string | null;
  author_bdrc_id?: string | null;
  parent_segment_id?: string | null;
  is_annotated: boolean;
  is_attached?: boolean | null;
  status?: OutlineSegmentStatus | null;
  label?: SegmentLabel | null;
  rejection?: SegmentRejection | null;
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
  title_span_start?: number | null;
  title_span_end?: number | null;
  updated_title?: string | null;
  author_span_start?: number | null;
  author_span_end?: number | null;
  updated_author?: string | null;
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
  const response = await fetch(`${OUTLINER_V1_URL}/documents`, {
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
  includeSegments: boolean = true,
  options?: { workspace?: boolean }
): Promise<OutlinerDocument> => {
  const params = new URLSearchParams();
  params.set('include_segments', String(includeSegments));
  const path = options?.workspace
    ? `${OUTLINER_V1_URL}/documents/${documentId}/workspace`
    : `${OUTLINER_V1_URL}/documents/${documentId}`;
  const url = `${path}?${params.toString()}`;
  const response = await fetch(url);
  const doc = await handleApiResponse(response);
  return withResolvedSegmentTexts(doc);
};

export const getOutlinerDocumentAiTocEntries = async (
  documentId: string
): Promise<OutlinerDocumentAiTocEntries> => {
  const response = await fetch(`${OUTLINER_V1_URL}/documents/${documentId}/toc`);
  return handleApiResponse(response);
};

export const listOutlinerDocuments = async (
  user_id?: string,
  skip: number = 0,
  limit: number = 100,
  include_deleted: boolean = false,
  title?: string
): Promise<OutlinerDocumentListItem[]> => {
  const params = new URLSearchParams();
  if (user_id) params.append('user_id', user_id);
  params.append('skip', skip.toString());
  params.append('limit', limit.toString());
  params.append('include_deleted', include_deleted.toString());
  if (title?.trim()) params.append('title', title.trim());

  const response = await fetch(`${OUTLINER_V1_URL}/documents?${params.toString()}`);
  return handleApiResponse(response);
};

export const updateOutlinerDocumentContent = async (
  documentId: string,
  content: string
): Promise<{ message: string; document_id: string }> => {
  const response = await fetch(`${OUTLINER_V1_URL}/documents/${documentId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });

  return handleApiResponse(response);
};

export const deleteOutlinerDocument = async (documentId: string): Promise<void> => {
  const response = await fetch(`${OUTLINER_V1_URL}/documents/${documentId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    await handleApiResponse(response);
  }
};

export const getDocumentProgress = async (
  documentId: string
): Promise<DocumentProgress> => {
  const response = await fetch(`${OUTLINER_V1_URL}/documents/${documentId}/stats`);
  return handleApiResponse(response);
};

// ==================== Segment Endpoints ====================

export const createSegment = async (
  documentId: string,
  segment: SegmentCreateRequest
): Promise<OutlinerSegment> => {
  const response = await fetch(`${OUTLINER_V1_URL}/documents/${documentId}/segments`, {
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
  const response = await fetch(`${OUTLINER_V1_URL}/documents/${documentId}/segments/bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(segments),
  });

  return handleApiResponse(response);
};

export const getSegments = async (documentId: string): Promise<OutlinerSegment[]> => {
  const response = await fetch(`${OUTLINER_V1_URL}/documents/${documentId}/segments`);
  return handleApiResponse(response);
};

export const getSegment = async (segmentId: string): Promise<OutlinerSegment> => {
  const response = await fetch(`${OUTLINER_V1_URL}/segments/${segmentId}`);
  return handleApiResponse(response);
};

export const updateSegment = async (
  segmentId: string,
  updates: SegmentUpdateRequest
): Promise<OutlinerSegment> => {
  const response = await fetch(`${OUTLINER_V1_URL}/segments/${segmentId}`, {
    method: 'PATCH',
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
  const response = await fetch(`${OUTLINER_V1_URL}/segments/bulk`, {
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
  const response = await fetch(`${OUTLINER_V1_URL}/segments/${segmentId}/split`, {
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
  const response = await fetch(`${OUTLINER_V1_URL}/segments/merge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ segment_ids: segmentIds }),
  });

  return handleApiResponse(response);
};

export const deleteSegment = async (segmentId: string): Promise<void> => {
  const response = await fetch(`${OUTLINER_V1_URL}/segments/${segmentId}`, {
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
  const response = await fetch(`${OUTLINER_V1_URL}/segments/${segmentId}/comments`);
  return handleApiResponse(response);
};

export const addSegmentComment = async (
  segmentId: string,
  comment: CommentCreateRequest
): Promise<Comment[]> => {
  const response = await fetch(`${OUTLINER_V1_URL}/segments/${segmentId}/comments`, {
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
  const response = await fetch(`${OUTLINER_V1_URL}/segments/${segmentId}/comments/${commentIndex}`, {
    method: 'PATCH',
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
  const response = await fetch(`${OUTLINER_V1_URL}/segments/${segmentId}/comments/${commentIndex}`, {
    method: 'DELETE',
  });

  return handleApiResponse(response);
};

export const assignVolume = async (user_id: string): Promise<OutlinerDocument> => {
  const response = await fetch(`${OUTLINER_V1_URL}/assignments/claim-next`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id }),
  });

  return handleApiResponse(response);
};


export const updateDocumentStatus = async (
  documentId: string,
  status: string,
  user_id?: string
): Promise<{ message: string; document_id: string; status: string }> => {
  const body: { status: string; user_id?: string } = { status };
  if (user_id) body.user_id = user_id;
  const response = await fetch(`${OUTLINER_V1_URL}/documents/${documentId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return handleApiResponse(response);
};

/** Push outline to BDRC OTAPI with status in_review and set document status to completed (single round-trip). */
export const submitDocumentToBdrcInReview = async (
  documentId: string
): Promise<Record<string, unknown>> => {
  const response = await fetch(
    `${OUTLINER_V1_URL}/documents/${documentId}/submissions/bdrc`,
    { method: 'POST' }
  );
  return handleApiResponse(response);
};

export const rejectSegment = async (
  segmentId: string,
  comment: string,
  reviewerId?: string
): Promise<OutlinerSegment> => {
  const response = await fetch(
    `${OUTLINER_V1_URL}/segments/${segmentId}/reviews/reject`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment, reviewer_id: reviewerId }),
    }
  );
  return handleApiResponse(response);
};

export const rejectSegmentsBulk = async (
  segmentIds: string[],
  comment: string,
  reviewerId?: string
): Promise<OutlinerSegment[]> => {
  const response = await fetch(`${OUTLINER_V1_URL}/reviews/rejections/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ segment_ids: segmentIds, reviewer_id: reviewerId, comment }),
  });
  return handleApiResponse(response);
};

export const updateSegmentStatus = async (
  segmentId: string,
  status: 'checked' | 'unchecked' | 'approved' | 'rejected'
): Promise<{ message: string; segment_id: string; status: string }> => {
  const response = await fetch(`${OUTLINER_V1_URL}/segments/${segmentId}/status`, {
    method: 'PATCH',
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
  const response = await fetch(`${OUTLINER_V1_URL}/documents/${documentId}/segments/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(operations),
  });

  return handleApiResponse(response);
};

export const resetSegments = async (documentId: string): Promise<void> => {
  const response = await fetch(`${OUTLINER_V1_URL}/documents/${documentId}/segments`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    await handleApiResponse(response);
  }
};

// ==================== Dashboard Stats ====================

export interface AnnotatorPerformanceRow {
  user_id: string | null;
  document_count: number;
  segment_count: number;
  segments_with_title_or_author: number;
  /** Unresolved rejected segments on that annotator's documents in range (latest rejection not resolved) */
  rejection_count: number;
}

export interface DashboardStats {
  document_count: number;
  total_segments: number;
  segments_with_title_or_author: number;
  /** Unresolved rejected segments: status rejected and latest rejection row is not resolved */
  rejection_count: number;
  document_status_counts: Record<string, number>;
  document_category_counts: Record<string, number>;
  segment_status_counts: Record<string, number>;
  segment_label_counts: Record<string, number>;
  segments_with_bdrc_id: number;
  segments_with_parent: number;
  /** Segments with status rejected that have stored comments */
  segments_with_comments: number;
  annotation_coverage_pct: number;
  /** Per-annotator breakdown (same date range as dashboard; not scoped by user filter). */
  annotator_performance?: AnnotatorPerformanceRow[];
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
  const response = await fetch(`${OUTLINER_V1_URL}/admin/stats${qs ? `?${qs}` : ''}`);
  return handleApiResponse(response);
};

// ==================== AI Endpoints ====================

/** Result of POST …/documents/:id/ai/outline — same shape as a full document with segments. */
export type AiOutlineResponse = Pick<
  OutlinerDocument,
  'id' | 'content' | 'filename' | 'user_id' | 'status' | 'created_at' | 'updated_at'
> & {
  is_supplied_title?: boolean | null;
  segments: OutlinerSegment[];
};

/**
 * Run AI TOC detection on the full document and replace segments with splits at detected indices
 * (backend: ai_text_outline.extract_toc_indices).
 */
export const runAiOutline = async (
  documentId: string,
  signal?: AbortSignal
): Promise<AiOutlineResponse> => {
  const response = await fetch(`${OUTLINER_V1_URL}/documents/${documentId}/ai/outline`, {
    method: 'POST',
    headers: { accept: 'application/json' },
    signal,
  });

  const data = await handleApiResponse(response);
  return withResolvedSegmentTexts(data);
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

export interface ParseTocRequest {
  content: string;
  /** When set, backend persists entries on this outliner document (or clears if not a TOC) */
  document_id?: string;
}

export interface ParseTocResponse {
  is_toc: boolean;
  entries: string[];
}


// ==================== Utility Functions ====================

/**
 * Convert OutlinerSegment to TextSegment format used in frontend
 */
export const outlinerSegmentToTextSegment = (
  segment: OutlinerSegment,
  documentContent: string
): TextSegment => {
  const text =
    segment.text ??
    segmentBodyFromDocument(documentContent, segment.span_start, segment.span_end);
  return {
    id: segment.id,
    text,
    span_start: segment.span_start,
    span_end: segment.span_end,
    title: segment.title || undefined,
    author: segment.author || undefined,
    title_span_start: segment.title_span_start ?? undefined,
    title_span_end: segment.title_span_end ?? undefined,
    updated_title: segment.updated_title ?? undefined,
    author_span_start: segment.author_span_start ?? undefined,
    author_span_end: segment.author_span_end ?? undefined,
    updated_author: segment.updated_author ?? undefined,
    title_bdrc_id: segment.title_bdrc_id || undefined,
    author_bdrc_id: segment.author_bdrc_id || undefined,
    parentSegmentId: segment.parent_segment_id || undefined,
    is_attached: segment.is_attached ?? undefined,
    status: segment.status || undefined,
    label: segment.label ?? undefined,
    rejection: segment.rejection ?? undefined,
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
