"""Queries for the Statistics page — annotator and reviewer approved-segment counts."""
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from outliner.models.outliner import OutlinerDocument, OutlinerSegment
from outliner.models.segment_rejection import SegmentRejection
from user.models.user import User


def _activity_time():
    """Effective approval date: reviewed_at, or April 1 of the segment's updated_at year."""
    april_default = func.make_timestamp(
        func.extract("year", OutlinerSegment.updated_at),
        4,
        1,
        0,
        0,
        0,
    )
    return func.coalesce(OutlinerSegment.reviewed_at, april_default)


def get_annotator_approved_counts(
    db: Session,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    user_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Per-annotator count of approved segments on that annotator's documents.

    Approved = status 'approved' (reviewer assignment not required).
    Date window: reviewed_at, or April 1 (updated_at year) when reviewed_at is null.
    Annotator identity is the document owner (document.user_id).
    """
    clauses = [
        (OutlinerDocument.status != "deleted") | (OutlinerDocument.status.is_(None)),
        OutlinerSegment.status == "approved"
    ]

    t = _activity_time()
    if start_date:
        clauses.append(t >= start_date)
    if end_date:
        clauses.append(t <= end_date)
    if user_id:
        clauses.append(OutlinerDocument.user_id == user_id)

    rows = (
        db.query(OutlinerDocument.user_id, func.count(OutlinerSegment.id))
        .join(OutlinerSegment, OutlinerSegment.document_id == OutlinerDocument.id)
        .filter(and_(*clauses))
        .group_by(OutlinerDocument.user_id)
        .all()
    )

    uid_to_approved: Dict[str, int] = {
        str(uid): int(cnt) for uid, cnt in rows if uid is not None
    }

    rt_trim = func.trim(func.coalesce(OutlinerSegment.reviewer_title, ""))
    ra_trim = func.trim(func.coalesce(OutlinerSegment.reviewer_author, ""))
    t_trim = func.trim(func.coalesce(OutlinerSegment.title, ""))
    au_trim = func.trim(func.coalesce(OutlinerSegment.author, ""))
    title_is_real_correction = and_(func.length(rt_trim) > 0, rt_trim != t_trim)
    author_is_real_correction = and_(func.length(ra_trim) > 0, ra_trim != au_trim)
    edited_clauses = clauses + [
        or_(title_is_real_correction, author_is_real_correction)
    ]
    edited_rows = (
        db.query(OutlinerDocument.user_id, func.count(OutlinerSegment.id))
        .join(OutlinerSegment, OutlinerSegment.document_id == OutlinerDocument.id)
        .filter(and_(*edited_clauses))
        .group_by(OutlinerDocument.user_id)
        .all()
    )
    uid_to_edited: Dict[str, int] = {
        str(uid): int(cnt) for uid, cnt in edited_rows if uid is not None
    }

    # Rejection counts from segment_rejections.user_id, date-filtered by created_at.
    rej_clauses = [SegmentRejection.user_id.isnot(None)]
    if start_date:
        rej_clauses.append(SegmentRejection.created_at >= start_date)
    if end_date:
        rej_clauses.append(SegmentRejection.created_at <= end_date)
    if user_id:
        rej_clauses.append(SegmentRejection.user_id == user_id)

    rej_rows = (
        db.query(SegmentRejection.user_id, func.count(SegmentRejection.id))
        .filter(and_(*rej_clauses))
        .group_by(SegmentRejection.user_id)
        .all()
    )
    uid_to_rejected: Dict[str, int] = {
        str(uid): int(cnt) for uid, cnt in rej_rows if uid is not None
    }

    # Distinct rejected segments per annotator (collapses repeat rejections of the
    # same segment). Used for a true rejection rate; same filters as rejection_count.
    rej_seg_rows = (
        db.query(
            SegmentRejection.user_id,
            func.count(func.distinct(SegmentRejection.segment_id)),
        )
        .filter(and_(*rej_clauses))
        .group_by(SegmentRejection.user_id)
        .all()
    )
    uid_to_rejected_segments: Dict[str, int] = {
        str(uid): int(cnt) for uid, cnt in rej_seg_rows if uid is not None
    }

    all_uids = uid_to_approved.keys() | uid_to_rejected.keys()

    user_rows = (
        db.query(User.id, User.name)
        .filter(User.id.in_(list(all_uids)))
        .all()
    )
    uid_to_name: Dict[str, str] = {
        str(uid): (name or uid) for uid, name in user_rows
    }

    result = [
        {
            "user_id": uid,
            "name": uid_to_name.get(uid, uid),
            "segments_approved": uid_to_approved.get(uid, 0),
            "edited_segments": uid_to_edited.get(uid, 0),
            "rejection_count": uid_to_rejected.get(uid, 0),
            "rejected_segments": uid_to_rejected_segments.get(uid, 0),
        }
        for uid in all_uids
    ]
    result.sort(key=lambda r: r["segments_approved"], reverse=True)
    return result


def get_reviewer_approved_counts(
    db: Session,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    user_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Per-reviewer count of segments they approved (status 'approved', reviewed_by_id = reviewer).

    Date window: reviewed_at, or April 1 (updated_at year) when reviewed_at is null.
    user_id filter here scopes by document.user_id (annotator), matching the page filter.
    """
    clauses = [
        (OutlinerDocument.status != "deleted") | (OutlinerDocument.status.is_(None)),
        OutlinerSegment.status == "approved",
        OutlinerSegment.reviewed_by_id.isnot(None),
    ]

    t = _activity_time()
    if start_date:
        clauses.append(t >= start_date)
    if end_date:
        clauses.append(t <= end_date)
    if user_id:
        clauses.append(OutlinerDocument.user_id == user_id)

    rows = (
        db.query(OutlinerSegment.reviewed_by_id, func.count(OutlinerSegment.id))
        .join(OutlinerDocument, OutlinerSegment.document_id == OutlinerDocument.id)
        .filter(and_(*clauses))
        .group_by(OutlinerSegment.reviewed_by_id)
        .all()
    )

    rid_to_reviewed: Dict[str, int] = {
        str(rid): int(cnt) for rid, cnt in rows if rid is not None
    }

    rt_trim = func.trim(func.coalesce(OutlinerSegment.reviewer_title, ""))
    ra_trim = func.trim(func.coalesce(OutlinerSegment.reviewer_author, ""))
    t_trim = func.trim(func.coalesce(OutlinerSegment.title, ""))
    au_trim = func.trim(func.coalesce(OutlinerSegment.author, ""))
    title_is_real_correction = and_(func.length(rt_trim) > 0, rt_trim != t_trim)
    author_is_real_correction = and_(func.length(ra_trim) > 0, ra_trim != au_trim)
    edited_clauses = clauses + [
        or_(title_is_real_correction, author_is_real_correction)
    ]
    edited_rows = (
        db.query(OutlinerSegment.reviewed_by_id, func.count(OutlinerSegment.id))
        .join(OutlinerDocument, OutlinerSegment.document_id == OutlinerDocument.id)
        .filter(and_(*edited_clauses))
        .group_by(OutlinerSegment.reviewed_by_id)
        .all()
    )
    rid_to_edited: Dict[str, int] = {
        str(rid): int(cnt) for rid, cnt in edited_rows if rid is not None
    }

    # Rejections filed by each reviewer, date-filtered by segment_rejections.created_at.
    rej_clauses = [SegmentRejection.reviewer_id.isnot(None)]
    if start_date:
        rej_clauses.append(SegmentRejection.created_at >= start_date)
    if end_date:
        rej_clauses.append(SegmentRejection.created_at <= end_date)
    if user_id:
        # scope by document annotator when user filter is active
        rej_clauses.append(OutlinerDocument.user_id == user_id)

    rej_query = (
        db.query(SegmentRejection.reviewer_id, func.count(SegmentRejection.id))
        .filter(and_(*rej_clauses))
        .group_by(SegmentRejection.reviewer_id)
    )
    if user_id:
        rej_query = (
            rej_query
            .join(OutlinerSegment, SegmentRejection.segment_id == OutlinerSegment.id)
            .join(OutlinerDocument, OutlinerSegment.document_id == OutlinerDocument.id)
        )

    rid_to_rejected: Dict[str, int] = {
        str(rid): int(cnt) for rid, cnt in rej_query.all() if rid is not None
    }

    all_rids = rid_to_reviewed.keys() | rid_to_edited.keys() | rid_to_rejected.keys()

    user_rows = (
        db.query(User.id, User.name)
        .filter(User.id.in_(list(all_rids)))
        .all()
    )
    rid_to_name: Dict[str, str] = {
        str(uid): (name or uid) for uid, name in user_rows
    }

    result = [
        {
            "user_id": rid,
            "name": rid_to_name.get(rid, rid),
            "segments_reviewed": rid_to_reviewed.get(rid, 0),
            "edited_segments": rid_to_edited.get(rid, 0),
            "rejection_count": rid_to_rejected.get(rid, 0),
        }
        for rid in all_rids
    ]
    result.sort(key=lambda r: r["segments_reviewed"], reverse=True)
    return result
