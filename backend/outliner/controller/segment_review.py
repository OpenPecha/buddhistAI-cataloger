from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

from outliner.models.outliner import SegmentReview
from outliner.repository.segment_queries import get_segment_plain
from outliner.repository.segment_review_decision import (
    get_reviewer_stats as get_reviewer_stats_repo,
    get_user_segment_review_statuses,
    upsert_segment_review,
)


def submit_segment_review(
    db: Session,
    segment_id: str,
    user_id: str,
    status: str,
    comment: str | None = None,
) -> SegmentReview:
    """Record the reviewer's approve/reject decision for a segment."""
    segment = get_segment_plain(db, segment_id)
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    return upsert_segment_review(
        db,
        segment_id=segment_id,
        document_id=segment.document_id,
        user_id=user_id,
        status=status,
        comment=comment,
    )


def get_segment_review_statuses(
    db: Session,
    document_id: str,
    user_id: str,
) -> dict[str, str]:
    return get_user_segment_review_statuses(
        db, document_id=document_id, user_id=user_id
    )


def get_reviewer_stats(
    db: Session,
    user_id: str | None = None,
    start_date=None,
    end_date=None,
) -> dict:
    return get_reviewer_stats_repo(
        db, user_id=user_id, start_date=start_date, end_date=end_date
    )
