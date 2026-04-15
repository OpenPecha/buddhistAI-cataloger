"""Shared helpers for legacy ``/outliner/*`` route handlers."""

from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from outliner.controller.outliner import (
    get_document as get_document_ctrl,
    get_segment_rejection_count as get_segment_rejection_count_ctrl,
    latest_rejection_reason_for_orm_segment as latest_rejection_reason_for_orm_segment_ctrl,
    latest_rejection_reviewer_for_orm_segment as latest_rejection_reviewer_for_orm_segment_ctrl,
    latest_rejection_resolved_for_orm_segment as latest_rejection_resolved_for_orm_segment_ctrl,
)
from outliner.utils.outliner_utils import get_comments_list, segment_body_from_document

from .schemas import (
    CommentResponse,
    SegmentRejectionReviewer,
    SegmentRejectionSummary,
    SegmentResponse,
    SegmentResponseDocument,
)


def segment_list_row_to_document_segment(row: dict) -> SegmentResponseDocument:
    """Build document segment payload; validates nested `rejection` when present."""
    return SegmentResponseDocument.model_validate(row)


def spans_from_toc_indices(content: str, indices: Optional[List]) -> List[Tuple[int, int]]:
    """Turn character offsets from extract_toc_indices into non-overlapping [start, end) spans."""
    n = len(content)
    starts: List[int] = []
    for i in indices or []:
        try:
            s = int(i)
        except (TypeError, ValueError):
            continue
        if 0 <= s <= n:
            starts.append(s)
    split_points = sorted(set([0] + [s for s in starts if s > 0]))
    spans: List[Tuple[int, int]] = []
    for idx, start in enumerate(split_points):
        end = split_points[idx + 1] if idx + 1 < len(split_points) else n
        if start < end:
            spans.append((start, end))
    return spans if spans else [(0, n)]


def build_segment_response(
    segment,
    db: Session = None,
    *,
    document_content: Optional[str] = None,
) -> SegmentResponse:
    """Helper to build SegmentResponse from segment model.

    When ``document_content`` is set (e.g. list segments without full document payload),
    ``text`` is filled from spans for backward compatibility. Otherwise ``text`` is omitted.
    """
    comments_list = get_comments_list(segment)

    rejection_count = 0
    if hasattr(segment, "rejections") and segment.rejections is not None:
        rejection_count = len(segment.rejections)
    elif db is not None:
        rejection_count = get_segment_rejection_count_ctrl(db, segment.id)

    label_value = segment.label.name if segment.label is not None else None
    rejection_reason = latest_rejection_reason_for_orm_segment_ctrl(db, segment)
    rr = latest_rejection_reviewer_for_orm_segment_ctrl(db, segment)
    rr_clean: Optional[Dict[str, Any]] = None
    if rr:
        rr_clean = dict(rr)
        if rr_clean.get("picture") is not None:
            rr_clean["picture"] = str(rr_clean["picture"]).strip() or None
    rejection: Optional[SegmentRejectionSummary] = None
    if rejection_count > 0 or segment.status == "rejected":
        rev = None
        if segment.status == "rejected" and rr_clean and rr_clean.get("id"):
            rev = SegmentRejectionReviewer(
                user_id=rr_clean["id"],
                picture=rr_clean.get("picture"),
                name=rr_clean.get("name"),
            )
        resolved_flag = (
            latest_rejection_resolved_for_orm_segment_ctrl(db, segment)
            if db is not None
            else None
        )
        rejection = SegmentRejectionSummary(
            count=rejection_count,
            reason=rejection_reason if segment.status == "rejected" else None,
            reviewer=rev,
            resolved=resolved_flag,
        )
    resolved_text: Optional[str] = None
    if document_content is not None:
        resolved_text = segment_body_from_document(
            document_content, segment.span_start, segment.span_end
        )

    return SegmentResponse(
        id=segment.id,
        text=resolved_text,
        segment_index=segment.segment_index,
        span_start=segment.span_start,
        span_end=segment.span_end,
        title=segment.title,
        author=segment.author,
        title_span_start=segment.title_span_start,
        title_span_end=segment.title_span_end,
        updated_title=segment.updated_title,
        author_span_start=segment.author_span_start,
        author_span_end=segment.author_span_end,
        updated_author=segment.updated_author,
        reviewer_title=segment.reviewer_title,
        reviewer_author=segment.reviewer_author,
        title_bdrc_id=segment.title_bdrc_id,
        author_bdrc_id=segment.author_bdrc_id,
        parent_segment_id=segment.parent_segment_id,
        is_annotated=segment.is_annotated,
        is_attached=segment.is_attached,
        status=segment.status,
        label=label_value,
        rejection=rejection,
        is_supplied_title=segment.is_supplied_title,
        comments=[CommentResponse(**c) for c in comments_list] if comments_list else None,
        created_at=segment.created_at,
        updated_at=segment.updated_at,
    )


def document_plain_content(db: Session, document_id: str) -> str:
    """Full document text for resolving segment bodies on segment-only responses."""
    doc = get_document_ctrl(db, document_id, include_segments=False)
    return doc.content or ""
