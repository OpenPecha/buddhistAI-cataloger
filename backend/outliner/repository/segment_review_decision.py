from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from outliner.models.outliner import SegmentReview
from user.models.user import User


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


def get_reviewer_stats(
    db: Session,
    *,
    user_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> dict[str, Any]:
    """Aggregate view-only spot-check decisions from segment_reviews."""
    base = db.query(SegmentReview)
    if user_id:
        base = base.filter(SegmentReview.user_id == user_id)
    if start_date:
        base = base.filter(SegmentReview.updated_at >= start_date)
    if end_date:
        base = base.filter(SegmentReview.updated_at <= end_date)

    total = base.count()
    total_approved = base.filter(SegmentReview.status == "approve").count()
    total_rejected = base.filter(SegmentReview.status == "reject").count()

    approved_case = case((SegmentReview.status == "approve", 1), else_=0)
    rejected_case = case((SegmentReview.status == "reject", 1), else_=0)

    per_reviewer = (
        db.query(
            SegmentReview.user_id,
            User.name,
            func.sum(approved_case).label("approvals"),
            func.sum(rejected_case).label("rejections"),
        )
        .join(User, User.id == SegmentReview.user_id)
    )
    if user_id:
        per_reviewer = per_reviewer.filter(SegmentReview.user_id == user_id)
    if start_date:
        per_reviewer = per_reviewer.filter(SegmentReview.updated_at >= start_date)
    if end_date:
        per_reviewer = per_reviewer.filter(SegmentReview.updated_at <= end_date)

    rows = (
        per_reviewer
        .group_by(SegmentReview.user_id, User.name)
        .order_by(func.sum(rejected_case).desc())
        .all()
    )

    reviewers = [
        {
            "user_id": r[0],
            "reviewer": r[1] or r[0],
            "approvals": int(r[2] or 0),
            "rejections": int(r[3] or 0),
        }
        for r in rows
    ]

    return {
        "segment_summary": {
            "total_segments": total,
            "approved": total_approved,
            "rejected": total_rejected,
        },
        "reviewer_breakdown": reviewers,
    }
