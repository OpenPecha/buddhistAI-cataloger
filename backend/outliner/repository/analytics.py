"""Cross-table aggregates for dashboard and annotator performance."""
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, case, func, or_
from sqlalchemy.orm import Session

from user.models.user import User

from outliner.models.outliner import OutlinerDocument, OutlinerSegment, SegmentRejection
from outliner.repository.segment_rejection import latest_rejection_row_per_segment_subquery

_REVIEWER_WORK_STATS_ROLES = frozenset({"reviewer", "admin"})


def _is_reviewer_or_admin_role(role: Optional[str]) -> bool:
    """Same normalization as ``outliner.deps.user_may_record_segment_reviewed_by`` role check."""
    norm = (role or "user").strip().lower()
    return norm in _REVIEWER_WORK_STATS_ROLES


def get_reviewer_segment_activity(
    db: Session,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    """
    Per-reviewer counts for segments, scoped to non-deleted documents.

    When ``start_date`` / ``end_date`` are set, only documents whose ``created_at`` falls in
    that range are included (same as dashboard ``segments_recorded_as_reviewer`` / annotator
    performance breakdown).

    ``segments_recorded_as_reviewer``: checked/approved segments where ``reviewed_by_id`` is set
    (reviewer/admin who moved the segment into review).

    ``reviewer_title_author_edits``: approved segments with reviewer title/author that actually
    differ from ``title`` / ``author`` (trimmed), same ``reviewed_by_id`` (best-effort attribution).

    ``reviewer_rejection_count``: rows in ``segment_rejections`` with ``reviewer_id`` set, on
    segments in scoped documents (same join and document date filter as annotator performance).
    """
    doc_filters = [
        (OutlinerDocument.status != "deleted") | (OutlinerDocument.status.is_(None))
    ]
    if start_date:
        doc_filters.append(OutlinerDocument.created_at >= start_date)
    if end_date:
        doc_filters.append(OutlinerDocument.created_at <= end_date)
    doc_scope = and_(*doc_filters)

    reviewed_when = or_(
        OutlinerSegment.status == "checked",
        OutlinerSegment.status == "approved",
    )

    recorded_rows = (
        db.query(OutlinerSegment.reviewed_by_id, func.count(OutlinerSegment.id))
        .join(OutlinerDocument, OutlinerSegment.document_id == OutlinerDocument.id)
        .filter(
            doc_scope,
            reviewed_when,
            OutlinerSegment.reviewed_by_id.isnot(None),
        )
        .group_by(OutlinerSegment.reviewed_by_id)
        .all()
    )
    recorded: Dict[str, int] = {
        str(rid): int(cnt) for rid, cnt in recorded_rows if rid is not None
    }

    rt = OutlinerSegment.reviewer_title
    ra = OutlinerSegment.reviewer_author
    t = OutlinerSegment.title
    au = OutlinerSegment.author
    rt_trim = func.trim(func.coalesce(rt, ""))
    ra_trim = func.trim(func.coalesce(ra, ""))
    t_trim = func.trim(func.coalesce(t, ""))
    au_trim = func.trim(func.coalesce(au, ""))
    title_is_real_correction = and_(
        rt.isnot(None),
        func.length(rt_trim) > 0,
        rt_trim != t_trim,
    )
    author_is_real_correction = and_(
        ra.isnot(None),
        func.length(ra_trim) > 0,
        ra_trim != au_trim,
    )
    correction_rows = (
        db.query(OutlinerSegment.reviewed_by_id, func.count(OutlinerSegment.id))
        .join(OutlinerDocument, OutlinerSegment.document_id == OutlinerDocument.id)
        .filter(
            doc_scope,
            OutlinerSegment.status == "approved",
            OutlinerSegment.reviewed_by_id.isnot(None),
            or_(title_is_real_correction, author_is_real_correction),
        )
        .group_by(OutlinerSegment.reviewed_by_id)
        .all()
    )
    corrections: Dict[str, int] = {
        str(rid): int(cnt) for rid, cnt in correction_rows if rid is not None
    }

    reviewer_rej_rows = (
        db.query(SegmentRejection.reviewer_id, func.count(SegmentRejection.id))
        .join(OutlinerSegment, SegmentRejection.segment_id == OutlinerSegment.id)
        .join(OutlinerDocument, OutlinerSegment.document_id == OutlinerDocument.id)
        .filter(doc_scope, SegmentRejection.reviewer_id.isnot(None))
        .group_by(SegmentRejection.reviewer_id)
        .all()
    )
    rejection_by_reviewer: Dict[str, int] = {
        str(rid): int(cnt) for rid, cnt in reviewer_rej_rows if rid is not None
    }

    role_norm = func.lower(func.trim(User.role))
    reviewer_id_rows = (
        db.query(User.id, User.role)
        .filter(
            User.role.isnot(None),
            role_norm.in_(tuple(_REVIEWER_WORK_STATS_ROLES)),
        )
        .all()
    )
    reviewer_ids = [
        str(uid)
        for uid, role in reviewer_id_rows
        if role is not None and _is_reviewer_or_admin_role(role)
    ]

    rows: List[Dict[str, Any]] = []
    for uid in reviewer_ids:
        rec = recorded.get(uid, 0)
        corr = corrections.get(uid, 0)
        rej = rejection_by_reviewer.get(uid, 0)
        rows.append(
            {
                "user_id": uid,
                "segments_recorded_as_reviewer": rec,
                "reviewer_title_author_edits": corr,
                "reviewer_rejection_count": rej,
            }
        )
    rows.sort(
        key=lambda r: (
            r["segments_recorded_as_reviewer"]
            + r["reviewer_title_author_edits"]
            + r["reviewer_rejection_count"],
            r["segments_recorded_as_reviewer"],
            r["reviewer_rejection_count"],
        ),
        reverse=True,
    )
    return rows


def get_annotator_performance_breakdown(
    db: Session,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    doc_filters = [
        (OutlinerDocument.status != "deleted") | (OutlinerDocument.status.is_(None))
    ]
    if start_date:
        doc_filters.append(OutlinerDocument.created_at >= start_date)
    if end_date:
        doc_filters.append(OutlinerDocument.created_at <= end_date)
    doc_scope = and_(*doc_filters)

    title_or_author = case(
        (
            or_(
                and_(OutlinerSegment.title.isnot(None), OutlinerSegment.title != ""),
                and_(OutlinerSegment.author.isnot(None), OutlinerSegment.author != ""),
            ),
            1,
        ),
        else_=0,
    )

    doc_rows = (
        db.query(OutlinerDocument.user_id, func.count(OutlinerDocument.id))
        .filter(doc_scope)
        .group_by(OutlinerDocument.user_id)
        .all()
    )
    seg_rows = (
        db.query(
            OutlinerDocument.user_id,
            func.count(OutlinerSegment.id),
            func.sum(title_or_author),
        )
        .join(OutlinerSegment, OutlinerSegment.document_id == OutlinerDocument.id)
        .filter(doc_scope)
        .group_by(OutlinerDocument.user_id)
        .all()
    )
    latest_rej_sq = latest_rejection_row_per_segment_subquery(db)
    rej_rows = (
        db.query(OutlinerDocument.user_id, func.count(OutlinerSegment.id))
        .join(OutlinerSegment, OutlinerSegment.document_id == OutlinerDocument.id)
        .join(
            latest_rej_sq,
            and_(
                OutlinerSegment.id == latest_rej_sq.c.segment_id,
                latest_rej_sq.c.rn == 1,
                or_(
                    latest_rej_sq.c.resolved.is_(False),
                    latest_rej_sq.c.resolved.is_(None),
                ),
            ),
        )
        .filter(doc_scope)
        .filter(OutlinerSegment.status == "rejected")
        .group_by(OutlinerDocument.user_id)
        .all()
    )

    reviewed_when = or_(
        OutlinerSegment.status == "checked",
        OutlinerSegment.status == "approved",
    )

    review_rows = (
        db.query(OutlinerSegment.reviewed_by_id, func.count(OutlinerSegment.id))
        .join(OutlinerDocument, OutlinerSegment.document_id == OutlinerDocument.id)
        .filter(
            doc_scope,
            OutlinerSegment.reviewed_by_id.isnot(None),
            reviewed_when,
        )
        .group_by(OutlinerSegment.reviewed_by_id)
        .all()
    )

    self_review_rows = (
        db.query(OutlinerSegment.reviewed_by_id, func.count(OutlinerSegment.id))
        .join(OutlinerDocument, OutlinerSegment.document_id == OutlinerDocument.id)
        .filter(
            doc_scope,
            OutlinerSegment.reviewed_by_id.isnot(None),
            OutlinerDocument.user_id == OutlinerSegment.reviewed_by_id,
            reviewed_when,
        )
        .group_by(OutlinerSegment.reviewed_by_id)
        .all()
    )

    reviewer_rej_rows = (
        db.query(SegmentRejection.reviewer_id, func.count(SegmentRejection.id))
        .join(OutlinerSegment, SegmentRejection.segment_id == OutlinerSegment.id)
        .join(OutlinerDocument, OutlinerSegment.document_id == OutlinerDocument.id)
        .filter(doc_scope, SegmentRejection.reviewer_id.isnot(None))
        .group_by(SegmentRejection.reviewer_id)
        .all()
    )

    annotator_for_rejection_events = func.coalesce(
        SegmentRejection.user_id,
        OutlinerDocument.user_id,
    )
    rejection_event_rows = (
        db.query(annotator_for_rejection_events, func.count(SegmentRejection.id))
        .select_from(SegmentRejection)
        .join(OutlinerSegment, SegmentRejection.segment_id == OutlinerSegment.id)
        .join(OutlinerDocument, OutlinerSegment.document_id == OutlinerDocument.id)
        .filter(doc_scope)
        .group_by(annotator_for_rejection_events)
        .all()
    )

    reviewer_title_author_edit_rows = (
        db.query(OutlinerDocument.user_id, func.count(OutlinerSegment.id))
        .join(OutlinerSegment, OutlinerSegment.document_id == OutlinerDocument.id)
        .filter(
            doc_scope,
            OutlinerSegment.status == "approved",
            or_(
                OutlinerSegment.reviewer_title.isnot(None),
                OutlinerSegment.reviewer_author.isnot(None),
            ),
        )
        .group_by(OutlinerDocument.user_id)
        .all()
    )

    def _default_row() -> Dict[str, int]:
        return {
            "document_count": 0,
            "segment_count": 0,
            "segments_with_title_or_author": 0,
            "rejection_count": 0,
            "rejection_event_count": 0,
            "segments_reviewed": 0,
            "segments_self_reviewed": 0,
            "reviewer_rejection_count": 0,
            "segments_reviewer_corrected_title_or_author": 0,
        }

    by_user: Dict[Any, Dict[str, int]] = {}
    for uid, cnt in doc_rows:
        by_user.setdefault(uid, _default_row())
        by_user[uid]["document_count"] = int(cnt)
    for uid, seg_cnt, titled in seg_rows:
        by_user.setdefault(uid, _default_row())
        by_user[uid]["segment_count"] = int(seg_cnt)
        by_user[uid]["segments_with_title_or_author"] = int(titled or 0)
    for uid, rej_cnt in rej_rows:
        by_user.setdefault(uid, _default_row())
        by_user[uid]["rejection_count"] = int(rej_cnt)

    for rid, cnt in review_rows:
        by_user.setdefault(rid, _default_row())
        by_user[rid]["segments_reviewed"] = int(cnt)
    for rid, cnt in self_review_rows:
        by_user.setdefault(rid, _default_row())
        by_user[rid]["segments_self_reviewed"] = int(cnt)
    for rid, cnt in reviewer_rej_rows:
        by_user.setdefault(rid, _default_row())
        by_user[rid]["reviewer_rejection_count"] = int(cnt)

    for uid, ev_cnt in rejection_event_rows:
        by_user.setdefault(uid, _default_row())
        by_user[uid]["rejection_event_count"] = int(ev_cnt)

    for uid, edit_cnt in reviewer_title_author_edit_rows:
        by_user.setdefault(uid, _default_row())
        by_user[uid]["segments_reviewer_corrected_title_or_author"] = int(edit_cnt)

    rows: List[Dict[str, Any]] = []
    for uid, m in by_user.items():
        seg_cnt = m["segment_count"]
        rej_ev = m["rejection_event_count"]
        rejection_events_pct = (
            round((rej_ev / seg_cnt) * 100, 1) if seg_cnt else None
        )
        rows.append(
            {
                "user_id": uid,
                "document_count": m["document_count"],
                "segment_count": m["segment_count"],
                "segments_with_title_or_author": m["segments_with_title_or_author"],
                "rejection_count": m["rejection_count"],
                "rejection_event_count": rej_ev,
                "rejection_events_pct_of_segments": rejection_events_pct,
                "segments_reviewed": m["segments_reviewed"],
                "segments_self_reviewed": m["segments_self_reviewed"],
                "reviewer_rejection_count": m["reviewer_rejection_count"],
                "segments_reviewer_corrected_title_or_author": m[
                    "segments_reviewer_corrected_title_or_author"
                ],
            }
        )
    rows.sort(
        key=lambda r: (
            r["segments_with_title_or_author"]
            + r["segments_reviewed"]
            + r["reviewer_rejection_count"],
            r["segment_count"],
        ),
        reverse=True,
    )
    return rows


def get_dashboard_stats(
    db: Session,
    user_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> Dict[str, Any]:
    doc_query_base = db.query(OutlinerDocument.id).filter(
        (OutlinerDocument.status != "deleted") | (OutlinerDocument.status.is_(None))
    )
    if start_date:
        doc_query_base = doc_query_base.filter(OutlinerDocument.created_at >= start_date)
    if end_date:
        doc_query_base = doc_query_base.filter(OutlinerDocument.created_at <= end_date)

    doc_query = doc_query_base
    if user_id:
        doc_query = doc_query.filter(OutlinerDocument.user_id == user_id)

    doc_ids_subq = doc_query.subquery()

    document_count = db.query(func.count()).select_from(doc_ids_subq).scalar() or 0

    seg_base = db.query(OutlinerSegment).filter(
        OutlinerSegment.document_id.in_(db.query(doc_ids_subq.c.id))
    )

    total_segments = seg_base.with_entities(func.count(OutlinerSegment.id)).scalar() or 0

    has_title_or_author = or_(
        and_(OutlinerSegment.title.isnot(None), OutlinerSegment.title != ""),
        and_(OutlinerSegment.author.isnot(None), OutlinerSegment.author != ""),
    )
    segment_reviewed_when = OutlinerSegment.status == "approved"
    segment_pending_review_when = OutlinerSegment.status == "checked"
    segment_rejected_when = OutlinerSegment.status == "rejected"
    segment_unchecked_when = or_(
        OutlinerSegment.status.is_(None), OutlinerSegment.status == "unchecked"
    )
    segments_with_title_or_author = (
        seg_base.filter(has_title_or_author)
        .with_entities(func.count(OutlinerSegment.id))
        .scalar()
        or 0
    )

    reviewed_segments = (
        seg_base.filter(has_title_or_author, segment_reviewed_when)
        .with_entities(func.count(OutlinerSegment.id))
        .scalar()
        or 0
    )

    annotated_segments = (
        seg_base.filter(has_title_or_author, segment_pending_review_when)
        .with_entities(func.count(OutlinerSegment.id))
        .scalar()
        or 0
    )

    rejected_segments_with_title_or_author = (
        seg_base.filter(has_title_or_author, segment_rejected_when)
        .with_entities(func.count(OutlinerSegment.id))
        .scalar()
        or 0
    )

    unchecked_segments_with_title_or_author = (
        seg_base.filter(has_title_or_author, segment_unchecked_when)
        .with_entities(func.count(OutlinerSegment.id))
        .scalar()
        or 0
    )

    annotating_segments = (
        seg_base.filter(segment_unchecked_when)
        .with_entities(func.count(OutlinerSegment.id))
        .scalar()
        or 0
    )

    latest_rej_sq = latest_rejection_row_per_segment_subquery(db)
    rejection_count = (
        seg_base.join(
            latest_rej_sq,
            and_(
                OutlinerSegment.id == latest_rej_sq.c.segment_id,
                latest_rej_sq.c.rn == 1,
                or_(
                    latest_rej_sq.c.resolved.is_(False),
                    latest_rej_sq.c.resolved.is_(None),
                ),
            ),
        )
        .filter(OutlinerSegment.status == "rejected")
        .with_entities(func.count(OutlinerSegment.id))
        .scalar()
        or 0
    )

    # Match get_annotator_performance_breakdown self_review_rows: reviewer recorded
    # while segment is checked or approved (not approved-only).
    segment_reviewed_or_checked = or_(
        OutlinerSegment.status == "checked",
        OutlinerSegment.status == "approved",
    )

    doc_id_filter = OutlinerDocument.id.in_(db.query(doc_ids_subq.c.id))

    doc_status_rows = (
        db.query(OutlinerDocument.status, func.count(OutlinerDocument.id))
        .filter(doc_id_filter)
        .group_by(OutlinerDocument.status)
        .all()
    )
    document_status_counts: Dict[str, int] = {}
    for status_val, cnt in doc_status_rows:
        key = status_val if status_val else "unknown"
        document_status_counts[key] = int(cnt)

    doc_category_rows = (
        db.query(OutlinerDocument.category, func.count(OutlinerDocument.id))
        .filter(doc_id_filter)
        .group_by(OutlinerDocument.category)
        .all()
    )
    document_category_counts: Dict[str, int] = {}
    for cat_val, cnt in doc_category_rows:
        key = cat_val if cat_val else "uncategorized"
        document_category_counts[key] = int(cnt)

    seg_status_rows = (
        db.query(OutlinerSegment.status, func.count(OutlinerSegment.id))
        .filter(OutlinerSegment.document_id.in_(db.query(doc_ids_subq.c.id)))
        .group_by(OutlinerSegment.status)
        .all()
    )
    segment_status_counts: Dict[str, int] = {}
    for status_val, cnt in seg_status_rows:
        key = status_val if status_val else "unchecked"
        segment_status_counts[key] = int(cnt)

    label_rows = (
        db.query(OutlinerSegment.label, func.count(OutlinerSegment.id))
        .filter(OutlinerSegment.document_id.in_(db.query(doc_ids_subq.c.id)))
        .group_by(OutlinerSegment.label)
        .all()
    )
    segment_label_counts: Dict[str, int] = {}
    for label_val, cnt in label_rows:
        if label_val is not None:
            key = label_val.value if hasattr(label_val, "value") else str(label_val)
        else:
            key = "unset"
        segment_label_counts[key] = int(cnt)

    segments_with_bdrc_id = (
        seg_base.filter(
            (OutlinerSegment.title_bdrc_id.isnot(None) & (OutlinerSegment.title_bdrc_id != ""))
            | (
                OutlinerSegment.author_bdrc_id.isnot(None)
                & (OutlinerSegment.author_bdrc_id != "")
            )
        )
        .with_entities(func.count(OutlinerSegment.id))
        .scalar()
        or 0
    )

    segments_with_parent = (
        seg_base.filter(OutlinerSegment.parent_segment_id.isnot(None))
        .with_entities(func.count(OutlinerSegment.id))
        .scalar()
        or 0
    )

    segments_with_comments = (
        seg_base.filter(
            OutlinerSegment.status == "rejected",
            OutlinerSegment.comment.isnot(None),
        )
        .with_entities(func.count(OutlinerSegment.id))
        .scalar()
        or 0
    )

    segments_reviewer_corrected_title_or_author = (
        seg_base.filter(
            OutlinerSegment.status == "approved",
            or_(
                OutlinerSegment.reviewer_title.isnot(None),
                OutlinerSegment.reviewer_author.isnot(None),
            ),
        )
        .with_entities(func.count(OutlinerSegment.id))
        .scalar()
        or 0
    )

   

    annotation_coverage_pct = (
        round((segments_with_title_or_author / total_segments) * 100, 1)
        if total_segments
        else 0.0
    )

    annotator_performance = get_annotator_performance_breakdown(
        db, start_date=start_date, end_date=end_date
    )

    reviewer_segment_activity = get_reviewer_segment_activity(
        db, start_date=start_date, end_date=end_date
    )

    return {
        "document_count": document_count,
        "total_segments": total_segments,
        "segments_with_title_or_author": segments_with_title_or_author,
        "reviewed_segments": reviewed_segments,
        "annotated_segments": annotated_segments,
        "rejected_segments_with_title_or_author": rejected_segments_with_title_or_author,
        "unchecked_segments_with_title_or_author": unchecked_segments_with_title_or_author,
        "annotating_segments": annotating_segments,
        "rejection_count": rejection_count,
        "document_status_counts": document_status_counts,
        "document_category_counts": document_category_counts,
        "segment_status_counts": segment_status_counts,
        "segment_label_counts": segment_label_counts,
        "segments_with_bdrc_id": segments_with_bdrc_id,
        "segments_with_parent": segments_with_parent,
        "segments_with_comments": segments_with_comments,
        "segments_reviewer_corrected_title_or_author": segments_reviewer_corrected_title_or_author,
        "annotation_coverage_pct": annotation_coverage_pct,
        "annotator_performance": annotator_performance,
        "reviewer_segment_activity": reviewer_segment_activity,
    }
