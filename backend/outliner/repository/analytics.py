"""Cross-table aggregates for dashboard and annotator performance."""
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, case, func, or_
from sqlalchemy.orm import Session

from user.models.user import User

from outliner.models.outliner import OutlinerDocument, OutlinerSegment, SegmentRejection
from outliner.repository.segment_rejection import latest_rejection_row_per_segment_subquery

_REVIEWER_WORK_STATS_ROLES = frozenset({"reviewer", "admin"})


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

    for uid, edit_cnt in reviewer_title_author_edit_rows:
        by_user.setdefault(uid, _default_row())
        by_user[uid]["segments_reviewer_corrected_title_or_author"] = int(edit_cnt)

    rows: List[Dict[str, Any]] = []
    for uid, m in by_user.items():
        rows.append(
            {
                "user_id": uid,
                "document_count": m["document_count"],
                "segment_count": m["segment_count"],
                "segments_with_title_or_author": m["segments_with_title_or_author"],
                "rejection_count": m["rejection_count"],
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
    segment_reviewed = OutlinerSegment.status == "approved"
    segments_self_reviewed_total = (
        seg_base.join(OutlinerDocument, OutlinerSegment.document_id == OutlinerDocument.id)
        .filter(
            segment_reviewed,
            OutlinerSegment.reviewed_by_id.isnot(None),
            OutlinerDocument.user_id == OutlinerSegment.reviewed_by_id,
        )
        .with_entities(func.count(OutlinerSegment.id))
        .scalar()
        or 0
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

    # Full reviewer workload: only for dashboard user_id whose account role is reviewer or admin.
    segments_recorded_as_reviewer: Optional[int] = None
    if user_id:
        filter_user_role = db.query(User.role).filter(User.id == user_id).scalar()
        if (
            filter_user_role
            and str(filter_user_role).lower() in _REVIEWER_WORK_STATS_ROLES
        ):
            doc_ids_all_subq = doc_query_base.subquery()
            segments_recorded_as_reviewer = (
                db.query(func.count(OutlinerSegment.id))
                .join(OutlinerDocument, OutlinerSegment.document_id == OutlinerDocument.id)
                .filter(
                    OutlinerDocument.id.in_(db.query(doc_ids_all_subq.c.id)),
                    OutlinerSegment.reviewed_by_id == user_id,
                    segment_reviewed_or_checked,
                )
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
        "segments_self_reviewed_total": segments_self_reviewed_total,
        "document_status_counts": document_status_counts,
        "document_category_counts": document_category_counts,
        "segment_status_counts": segment_status_counts,
        "segment_label_counts": segment_label_counts,
        "segments_with_bdrc_id": segments_with_bdrc_id,
        "segments_with_parent": segments_with_parent,
        "segments_with_comments": segments_with_comments,
        "segments_reviewer_corrected_title_or_author": segments_reviewer_corrected_title_or_author,
        "segments_recorded_as_reviewer": segments_recorded_as_reviewer,
        "annotation_coverage_pct": annotation_coverage_pct,
        "annotator_performance": annotator_performance,
    }
