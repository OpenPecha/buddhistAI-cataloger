"""Read/query helpers for outliner_segment rows."""
from typing import Dict, List, Optional

from sqlalchemy import and_, case, func, or_
from sqlalchemy.orm import Session, joinedload

from outliner.models.outliner import OutlinerDocument, OutlinerSegment, SegmentRejection
from outliner.repository.segment_rejection import update_segment_with_rejection_fields


def _segment_aggregate_counts_by_document_ids(
    db: Session, document_ids: List[str]
) -> Dict[str, Dict[str, int]]:
    """
    One grouped query for list_documents stats (avoids N×5 count queries per document).
    Mirrors the same status predicates as the previous per-document counts.
    """
    if not document_ids:
        return {}
    checked_when = or_(
        OutlinerSegment.status == "checked",
        OutlinerSegment.status == "approved",
    )
    unchecked_when = or_(
        OutlinerSegment.status.is_(None),
        and_(
            OutlinerSegment.status != "checked",
            OutlinerSegment.status != "approved",
        ),
    )
    checked_expr = case((checked_when, 1), else_=0)
    unchecked_expr = case((unchecked_when, 1), else_=0)
    annotated_expr = case((OutlinerSegment.is_annotated == True, 1), else_=0)
    rejected_expr = case((OutlinerSegment.status == "rejected", 1), else_=0)

    rows = (
        db.query(
            OutlinerSegment.document_id.label("doc_id"),
            func.count(OutlinerSegment.id).label("total_segments"),
            func.sum(checked_expr).label("checked_segments"),
            func.sum(unchecked_expr).label("unchecked_segments"),
            func.sum(annotated_expr).label("annotated_segments"),
            func.sum(rejected_expr).label("rejection_count"),
        )
        .filter(OutlinerSegment.document_id.in_(document_ids))
        .group_by(OutlinerSegment.document_id)
        .all()
    )
    out: Dict[str, Dict[str, int]] = {}
    for row in rows:
        out[row.doc_id] = {
            "total_segments": int(row.total_segments or 0),
            "checked_segments": int(row.checked_segments or 0),
            "unchecked_segments": int(row.unchecked_segments or 0),
            "annotated_segments": int(row.annotated_segments or 0),
            "rejection_count": int(row.rejection_count or 0),
        }
    return out


def _rejection_comment_counts_by_document_ids(
    db: Session, document_ids: List[str]
) -> Dict[str, int]:
    """Total ``segment_rejections`` rows per document (historical rejection comments)."""
    if not document_ids:
        return {}
    rows = (
        db.query(
            OutlinerSegment.document_id.label("doc_id"),
            func.count(SegmentRejection.id).label("cnt"),
        )
        .join(SegmentRejection, SegmentRejection.segment_id == OutlinerSegment.id)
        .filter(OutlinerSegment.document_id.in_(document_ids))
        .group_by(OutlinerSegment.document_id)
        .all()
    )
    return {r.doc_id: int(r.cnt or 0) for r in rows}


def _rejection_open_segments_by_document_ids(
    db: Session, document_ids: List[str]
) -> Dict[str, int]:
    """
    Per document: distinct segments that have at least one ``segment_rejections`` row
    and are not yet ``checked`` or ``approved`` (annotator still on the rejection path).
    """
    if not document_ids:
        return {}
    not_addressed = or_(
        OutlinerSegment.status.is_(None),
        and_(
            OutlinerSegment.status != "checked",
            OutlinerSegment.status != "approved",
        ),
    )
    rows = (
        db.query(
            OutlinerSegment.document_id.label("doc_id"),
            func.count(func.distinct(OutlinerSegment.id)).label("cnt"),
        )
        .join(SegmentRejection, SegmentRejection.segment_id == OutlinerSegment.id)
        .filter(OutlinerSegment.document_id.in_(document_ids))
        .filter(not_addressed)
        .group_by(OutlinerSegment.document_id)
        .all()
    )
    return {r.doc_id: int(r.cnt or 0) for r in rows}


def segment_list_for_document(db: Session, document_id: str) -> List[dict]:
    segments = (
        db.query(
            OutlinerSegment.id,
            OutlinerSegment.segment_index,
            OutlinerSegment.span_start,
            OutlinerSegment.span_end,
            OutlinerSegment.title,
            OutlinerSegment.title_span_start,
            OutlinerSegment.title_span_end,
            OutlinerSegment.updated_title,
            OutlinerSegment.author,
            OutlinerSegment.author_span_start,
            OutlinerSegment.author_span_end,
            OutlinerSegment.updated_author,
            OutlinerSegment.reviewer_title,
            OutlinerSegment.reviewer_author,
            OutlinerSegment.title_bdrc_id,
            OutlinerSegment.author_bdrc_id,
            OutlinerSegment.parent_segment_id,
            OutlinerSegment.is_annotated,
            OutlinerSegment.is_attached,
            OutlinerSegment.status,
            OutlinerSegment.is_supplied_title,
            OutlinerSegment.label,
        )
        .filter(OutlinerSegment.document_id == document_id)
        .order_by(OutlinerSegment.segment_index)
        .all()
    )

    def _segment_to_dict(segment):
        d = segment._asdict()
        d["label"] = segment.label.name if segment.label else None
        return d

    segment_list = [_segment_to_dict(segment) for segment in segments]
    update_segment_with_rejection_fields(db, segment_list)
    return segment_list


def list_segments(db: Session, document_id: str) -> List[OutlinerSegment]:
    return (
        db.query(OutlinerSegment)
        .options(joinedload(OutlinerSegment.rejections))
        .filter(OutlinerSegment.document_id == document_id)
        .order_by(OutlinerSegment.segment_index)
        .all()
    )


def get_segment_with_rejections(db: Session, segment_id: str) -> Optional[OutlinerSegment]:
    return (
        db.query(OutlinerSegment)
        .options(joinedload(OutlinerSegment.rejections))
        .filter(OutlinerSegment.id == segment_id)
        .first()
    )


def get_segment_plain(db: Session, segment_id: str) -> Optional[OutlinerSegment]:
    return db.query(OutlinerSegment).filter(OutlinerSegment.id == segment_id).first()


def get_document_user_id_for_segment(db: Session, segment_id: str) -> Optional[str]:
    """Outliner document ``user_id`` (assignee/owner) for this segment, if any."""
    row = (
        db.query(OutlinerDocument.user_id)
        .join(OutlinerSegment, OutlinerSegment.document_id == OutlinerDocument.id)
        .filter(OutlinerSegment.id == segment_id)
        .first()
    )
    if not row:
        return None
    uid = row[0]
    return str(uid) if uid is not None else None


def map_segment_ids_to_document_user_ids(
    db: Session, segment_ids: List[str]
) -> Dict[str, Optional[str]]:
    """Map segment id → document owner ``user_id`` for attribution checks."""
    if not segment_ids:
        return {}
    rows = (
        db.query(OutlinerSegment.id, OutlinerDocument.user_id)
        .join(OutlinerDocument, OutlinerSegment.document_id == OutlinerDocument.id)
        .filter(OutlinerSegment.id.in_(segment_ids))
        .all()
    )
    out: Dict[str, Optional[str]] = {}
    for sid, uid in rows:
        out[str(sid)] = str(uid) if uid is not None else None
    return out


def get_segment_by_pk(db: Session, segment_id: str) -> Optional[OutlinerSegment]:
    return db.get(OutlinerSegment, segment_id)


def document_has_any_segment(db: Session, document_id: str) -> bool:
    return (
        db.query(OutlinerSegment.id)
        .filter(OutlinerSegment.document_id == document_id)
        .first()
        is not None
    )


def fetch_segments_ordered_by_ids(
    db: Session, segment_ids: List[str]
) -> List[OutlinerSegment]:
    return (
        db.query(OutlinerSegment)
        .filter(OutlinerSegment.id.in_(segment_ids))
        .order_by(OutlinerSegment.segment_index)
        .all()
    )


def fetch_following_segments_excluding_ids(
    db: Session,
    document_id: str,
    min_index: int,
    exclude_ids: List[str],
) -> List[OutlinerSegment]:
    return (
        db.query(OutlinerSegment)
        .filter(
            OutlinerSegment.document_id == document_id,
            OutlinerSegment.segment_index > min_index,
            ~OutlinerSegment.id.in_(exclude_ids),
        )
        .all()
    )


def fetch_following_segments_by_index(
    db: Session, document_id: str, segment_index: int
) -> List[OutlinerSegment]:
    return (
        db.query(OutlinerSegment)
        .filter(
            OutlinerSegment.document_id == document_id,
            OutlinerSegment.segment_index > segment_index,
        )
        .all()
    )


def fetch_segments_by_ids_for_document(
    db: Session, segment_ids: List[str], document_id: str
) -> List[OutlinerSegment]:
    return (
        db.query(OutlinerSegment)
        .filter(
            OutlinerSegment.id.in_(segment_ids),
            OutlinerSegment.document_id == document_id,
        )
        .all()
    )


def max_segment_index(db: Session, document_id: str) -> int:
    return db.query(func.max(OutlinerSegment.segment_index)).filter(
        OutlinerSegment.document_id == document_id
    ).scalar() or -1


def fetch_segments_for_bulk_update(
    db: Session, segment_ids: List[str], document_id: str
) -> List[OutlinerSegment]:
    return (
        db.query(OutlinerSegment)
        .filter(
            OutlinerSegment.id.in_(segment_ids),
            OutlinerSegment.document_id == document_id,
        )
        .all()
    )


def fetch_segments_by_ids(db: Session, segment_ids: List[str]) -> List[OutlinerSegment]:
    return db.query(OutlinerSegment).filter(OutlinerSegment.id.in_(segment_ids)).all()


def count_non_approved_segments(db: Session, document_id: str) -> int:
    return (
        db.query(func.count(OutlinerSegment.id))
        .filter(
            OutlinerSegment.document_id == document_id,
            OutlinerSegment.status != "approved",
        )
        .scalar()
        or 0
    )
