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
    """Aggregate view-only review-verification decisions from segment_reviews."""
    from outliner.models.outliner import OutlinerSegment

    approved_case = case((SegmentReview.status == "approve", 1), else_=0)
    rejected_case = case((SegmentReview.status == "reject", 1), else_=0)

    def _apply_filters(q):
        if user_id:
            q = q.filter(SegmentReview.user_id == user_id)
        if start_date:
            q = q.filter(SegmentReview.updated_at >= start_date)
        if end_date:
            q = q.filter(SegmentReview.updated_at <= end_date)
        return q

    verifier_q = _apply_filters(
        db.query(
            SegmentReview.user_id,
            User.name,
            func.count().label("total_segments"),
            func.sum(approved_case).label("approvals"),
            func.sum(rejected_case).label("rejections"),
        )
        .join(User, User.id == SegmentReview.user_id)
    )
    verifier_rows = (
        verifier_q
        .group_by(SegmentReview.user_id, User.name)
        .order_by(func.sum(rejected_case).desc())
        .all()
    )
    review_verifiers = [
        {
            "user_id": r[0],
            "reviewer": r[1] or r[0],
            "total_segments": int(r[2] or 0),
            "approvals": int(r[3] or 0),
            "rejections": int(r[4] or 0),
        }
        for r in verifier_rows
    ]

    all_reviewers = (
        db.query(User.id, User.name)
        .filter(User.role == "reviewer")
        .all()
    )

    review_counts_q = _apply_filters(
        db.query(
            OutlinerSegment.reviewed_by_id,
            func.sum(approved_case).label("approvals"),
            func.sum(rejected_case).label("rejections"),
        )
        .join(OutlinerSegment, OutlinerSegment.id == SegmentReview.segment_id)
    )
    counts_by_reviewer = {
        r[0]: {"approvals": int(r[1] or 0), "rejections": int(r[2] or 0)}
        for r in review_counts_q.group_by(OutlinerSegment.reviewed_by_id).all()
    }

    doc_reviewers = [
        {
            "user_id": uid,
            "reviewer": name or uid,
            "approvals": counts_by_reviewer.get(uid, {}).get("approvals", 0),
            "rejections": counts_by_reviewer.get(uid, {}).get("rejections", 0),
        }
        for uid, name in all_reviewers
    ]

    # Segments reviewed before reviewed_by_id existed have no reviewer; bucket them as Unknown.
    unknown = counts_by_reviewer.get(None)
    if unknown:
        doc_reviewers.append(
            {
                "user_id": "unknown",
                "reviewer": "Unknown",
                "approvals": unknown["approvals"],
                "rejections": unknown["rejections"],
            }
        )

    doc_reviewers.sort(key=lambda r: r["rejections"], reverse=True)

    return {
        "review_verifier_breakdown": review_verifiers,
        "reviewer_breakdown": doc_reviewers,
    }
