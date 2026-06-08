from __future__ import annotations

from sqlalchemy.orm import Session

from outliner.models.outliner import SegmentReview


def upsert_segment_review(
    db: Session,
    *,
    segment_id: str,
    document_id: str,
    user_id: str,
    status: str,
    comment: str | None = None,
) -> SegmentReview:
    """Insert or update this user's decision for a segment (one row per user + segment)."""
    comment = (comment or "").strip() or None
    review = (
        db.query(SegmentReview)
        .filter(
            SegmentReview.user_id == user_id,
            SegmentReview.segment_id == segment_id,
        )
        .first()
    )
    if review is None:
        review = SegmentReview(
            document_id=document_id,
            segment_id=segment_id,
            user_id=user_id,
            status=status,
            comment=comment,
        )
        db.add(review)
    else:
        review.status = status
        review.comment = comment
    db.commit()
    db.refresh(review)
    return review


def get_user_segment_review_statuses(
    db: Session,
    *,
    document_id: str,
    user_id: str,
) -> dict[str, str]:
    rows = (
        db.query(SegmentReview.segment_id, SegmentReview.status)
        .filter(
            SegmentReview.user_id == user_id,
            SegmentReview.document_id == document_id,
        )
        .all()
    )
    return dict(rows)
