"""
SQLAlchemy data access for outliner documents, segments, rejections, and aggregates.
"""
import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, case, exists, func, or_, update
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.orm.attributes import flag_modified

from user.models.user import User
from outliner.models.outliner import (
    OutlinerDocument,
    OutlinerSegment,
    SegmentRejection,
)
from outliner.utils.outliner_utils import (
    get_comments_list,
    infer_segment_label_for_new_segment,
    validate_segment_status_transition,
)


def apply_segment_review_metadata(
    segment: OutlinerSegment,
    old_status: Optional[str],
    new_status: str,
    reviewer_id: Optional[str],
) -> None:
    """Track who set checked/approved; clear when segment is unchecked or rejected."""
    ns = (new_status or "").strip().lower()
    if ns in ("checked", "approved"):
        if reviewer_id:
            segment.reviewed_by_id = reviewer_id
            segment.reviewed_at = datetime.utcnow()
    elif ns in ("unchecked", "rejected"):
        segment.reviewed_by_id = None
        segment.reviewed_at = None


def _norm_segment_text(val: Optional[str]) -> str:
    return (val or "").strip()


def apply_segment_review_title_author_tracking(
    segment: OutlinerSegment,
    old_status: Optional[str],
    new_status: str,
) -> None:
    """
    When entering `checked`, snapshot title/author as the annotator submission.
    When moving `checked` -> `approved`, clear pre_review snapshots only; reviewer_title/author
    are set only via explicit PATCH (reviewer suggestions), not by overwriting annotator title/author.
    Clear snapshots and reviewer fields on unchecked/rejected (and when leaving approved to unchecked).
    """
    os = (old_status or "").strip().lower()
    ns = (new_status or "").strip().lower()

    if ns == "checked" and os in ("unchecked", "rejected", ""):
        segment.pre_review_title = segment.title
        segment.pre_review_author = segment.author
        return

    if ns == "approved" and os == "checked":
        segment.pre_review_title = None
        segment.pre_review_author = None
        return

    if ns in ("unchecked", "rejected"):
        segment.pre_review_title = None
        segment.pre_review_author = None
        segment.reviewer_title = None
        segment.reviewer_author = None


# ----- Document list & rejections (document list / segment payloads) -----


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


def list_documents(
    db: Session,
    user_id: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    include_deleted: bool = False,
    title: Optional[str] = None,
) -> List[Dict[str, Any]]:
    query = db.query(OutlinerDocument)
    if user_id:
        query = query.filter(OutlinerDocument.user_id == user_id)

    if status:
        query = query.filter(OutlinerDocument.status == status)

    if title and title.strip():
        escaped = (
            title.strip()
            .replace("\\", "\\\\")
            .replace("%", "\\%")
            .replace("_", "\\_")
        )
        query = query.filter(OutlinerDocument.filename.ilike(f"%{escaped}%", escape="\\"))

    if not include_deleted:
        query = query.filter(
            (OutlinerDocument.status != "deleted") | (OutlinerDocument.status.is_(None))
        )

    documents = query.order_by(OutlinerDocument.updated_at.desc()).offset(skip).limit(limit).all()
    doc_ids = [d.id for d in documents]
    latest_rejection_by_doc = latest_rejection_notice_by_document_ids(db, doc_ids)
    counts_by_doc = _segment_aggregate_counts_by_document_ids(db, doc_ids)

    result = []
    for doc in documents:
        agg = counts_by_doc.get(doc.id)
        if agg is None:
            total = checked = unchecked = annotated = rejection_count = 0
        else:
            total = agg["total_segments"]
            checked = agg["checked_segments"]
            unchecked = agg["unchecked_segments"]
            annotated = agg["annotated_segments"]
            rejection_count = agg["rejection_count"]
        result.append(
            {
                "id": doc.id,
                "filename": doc.filename,
                "user_id": doc.user_id,
                "checked_segments": checked,
                "unchecked_segments": unchecked,
                "total_segments": total,
                "annotated_segments": annotated,
                "rejection_count": rejection_count,
                "progress_percentage": (annotated / total) * 100 if total > 0 else 0,
                "status": doc.status,
                "created_at": doc.created_at,
                "updated_at": doc.updated_at,
                "rejected_segment": latest_rejection_by_doc.get(doc.id),
            }
        )

    return result


def rejection_counts_reasons_reviewers_by_segment_ids(
    db: Session, segment_ids: List[str]
) -> Tuple[
    Dict[str, int],
    Dict[str, Optional[str]],
    Dict[str, Optional[Dict[str, Any]]],
    Dict[str, Optional[bool]],
]:
    if not segment_ids:
        return {}, {}, {}, {}
    rows = (
        db.query(
            SegmentRejection.segment_id,
            SegmentRejection.created_at,
            SegmentRejection.id,
            SegmentRejection.rejection_reason,
            SegmentRejection.reviewer_id,
            SegmentRejection.resolved,
            User.name,
            User.picture,
        )
        .outerjoin(User, User.id == SegmentRejection.reviewer_id)
        .filter(SegmentRejection.segment_id.in_(segment_ids))
        .all()
    )
    by_seg: Dict[str, List[Any]] = {}
    for (
        segment_id,
        created_at,
        rid,
        rejection_reason,
        reviewer_id,
        resolved,
        name,
        picture,
    ) in rows:
        by_seg.setdefault(segment_id, []).append(
            (created_at, rid, rejection_reason, reviewer_id, name, picture, resolved)
        )
    counts: Dict[str, int] = {}
    reasons: Dict[str, Optional[str]] = {}
    reviewers: Dict[str, Optional[Dict[str, Any]]] = {}
    latest_resolved: Dict[str, Optional[bool]] = {}
    for sid, items in by_seg.items():
        counts[sid] = len(items)
        latest = max(
            items,
            key=lambda t: (
                t[0] if t[0] is not None else datetime.min,
                t[1] or "",
            ),
        )
        reasons[sid] = latest[2]
        rev_id, rev_name, rev_pic = latest[3], latest[4], latest[5]
        latest_resolved[sid] = latest[6]
        if not rev_id:
            reviewers[sid] = None
        else:
            reviewers[sid] = {"id": rev_id, "name": rev_name, "picture": rev_pic}
    return counts, reasons, reviewers, latest_resolved


def latest_rejection_notice_by_document_ids(
    db: Session, document_ids: List[str]
) -> Dict[str, Optional[Dict[str, Any]]]:
    if not document_ids:
        return {}
    rn = (
        func.row_number()
        .over(
            partition_by=OutlinerSegment.document_id,
            order_by=SegmentRejection.created_at.desc(),
        )
        .label("rn")
    )
    subq = (
        db.query(
            OutlinerSegment.document_id.label("document_id"),
            SegmentRejection.segment_id.label("segment_id"),
            SegmentRejection.rejection_reason.label("rejection_reason"),
            SegmentRejection.reviewer_id.label("reviewer_id"),
            User.name.label("reviewer_name"),
            User.picture.label("reviewer_picture"),
            rn,
        )
        .select_from(SegmentRejection)
        .join(OutlinerSegment, SegmentRejection.segment_id == OutlinerSegment.id)
        .outerjoin(User, SegmentRejection.reviewer_id == User.id)
        .filter(OutlinerSegment.document_id.in_(document_ids))
        .filter(
            or_(
                SegmentRejection.resolved.is_(False),
                SegmentRejection.resolved.is_(None),
            )
        )
        .subquery()
    )
    rows = (
        db.query(
            subq.c.document_id,
            subq.c.segment_id,
            subq.c.rejection_reason,
            subq.c.reviewer_id,
            subq.c.reviewer_name,
            subq.c.reviewer_picture,
        )
        .filter(subq.c.rn == 1)
        .all()
    )
    out: Dict[str, Optional[Dict[str, Any]]] = {}
    for doc_id, seg_id, reason, reviewer_id, rev_name, rev_pic in rows:
        rev_user = None
        if reviewer_id:
            pic = rev_pic
            if pic is not None:
                pic = str(pic).strip() or None
            rev_user = {"name": rev_name, "picture": pic}
        out[doc_id] = {
            "message": (reason or "").strip(),
            "document_id": doc_id,
            "segment_id": seg_id,
            "reviewer_user": rev_user,
        }
    return out


def update_segment_with_rejection_fields(db: Session, segment_list: List[dict]) -> None:
    if not segment_list:
        return
    ids = [s["id"] for s in segment_list]
    counts, reasons, reviewers, latest_resolved = rejection_counts_reasons_reviewers_by_segment_ids(
        db, ids
    )
    for s in segment_list:
        sid = s["id"]
        count = counts.get(sid, 0)
        if count == 0 and s.get("status") != "rejected":
            s["rejection"] = None
            continue
        reason = None
        reviewer_payload = None
        if s.get("status") == "rejected":
            reason = reasons.get(sid)
        rr = reviewers.get(sid)
        if rr and rr.get("id"):
            p = rr.get("picture")
            if p is not None:
                p = str(p).strip() or None
            reviewer_payload = {
                "user_id": rr["id"],
                "picture": p,
                "name": rr.get("name"),
            }
        s["rejection"] = {
            "count": count,
            "reason": reason,
            "reviewer": reviewer_payload,
            "resolved": latest_resolved.get(sid),
        }


def latest_rejection_reason_for_orm_segment(
    db: Optional[Session], segment: OutlinerSegment
) -> Optional[str]:
    if segment.status != "rejected":
        return None
    rel = getattr(segment, "rejections", None)
    if rel:
        latest = max(rel, key=lambda r: r.created_at)
        return latest.rejection_reason
    if db is None:
        return None
    row = (
        db.query(SegmentRejection)
        .filter(SegmentRejection.segment_id == segment.id)
        .order_by(SegmentRejection.created_at.desc())
        .first()
    )
    return row.rejection_reason if row else None


def latest_rejection_resolved_for_orm_segment(
    db: Optional[Session], segment: OutlinerSegment
) -> Optional[bool]:
    """`resolved` flag on the most recent rejection row for this segment."""
    rel = getattr(segment, "rejections", None)
    if rel:
        latest = max(rel, key=lambda r: r.created_at)
        return latest.resolved
    if db is None:
        return None
    row = (
        db.query(SegmentRejection.resolved)
        .filter(SegmentRejection.segment_id == segment.id)
        .order_by(SegmentRejection.created_at.desc())
        .first()
    )
    return row[0] if row else None


def mark_latest_rejection_resolved(db: Session, segment_id: str) -> None:
    """Set `resolved` on the newest rejection row when the annotator saves the segment."""
    row = (
        db.query(SegmentRejection)
        .filter(SegmentRejection.segment_id == segment_id)
        .order_by(SegmentRejection.created_at.desc())
        .first()
    )
    if row is not None and row.resolved is not True:
        row.resolved = True


def latest_rejection_reviewer_for_orm_segment(
    db: Optional[Session], segment: OutlinerSegment
) -> Optional[Dict[str, Any]]:
    if segment.status != "rejected":
        return None
    if db is not None:
        row = (
            db.query(SegmentRejection.reviewer_id, User.name, User.picture)
            .outerjoin(User, User.id == SegmentRejection.reviewer_id)
            .filter(SegmentRejection.segment_id == segment.id)
            .order_by(SegmentRejection.created_at.desc())
            .first()
        )
        if not row:
            return None
        reviewer_id, name, picture = row[0], row[1], row[2]
        if not reviewer_id:
            return None
        return {"id": reviewer_id, "name": name, "picture": picture}
    rel = getattr(segment, "rejections", None)
    if not rel:
        return None
    latest = max(rel, key=lambda r: r.created_at)
    rid = latest.reviewer_id
    if not rid:
        return None
    return {"id": rid, "name": None, "picture": None}


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


def fetch_document_workspace_row(
    db: Session, document_id: str
) -> Optional[Any]:
    return (
        db.query(
            OutlinerDocument.id,
            OutlinerDocument.filename,
            OutlinerDocument.status,
        )
        .filter(OutlinerDocument.id == document_id)
        .first()
    )


def fetch_document_by_filename(db: Session, filename: str) -> Optional[OutlinerDocument]:
    return db.query(OutlinerDocument).filter(OutlinerDocument.filename == filename).first()


def insert_document(
    db: Session,
    content: str,
    filename: Optional[str] = None,
    user_id: Optional[str] = None,
) -> OutlinerDocument:
    db_document = OutlinerDocument(
        id=str(uuid.uuid4()),
        content=content,
        filename=filename,
        user_id=user_id,
        status="active",
    )
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    return db_document


def update_document_content(
    db: Session,
    document_id: str,
    content: str,
) -> bool:
    document = db.query(OutlinerDocument).filter(OutlinerDocument.id == document_id).first()
    if not document:
        return False
    document.content = content
    document.updated_at = datetime.utcnow()
    db.commit()
    return True


def delete_document(db: Session, document_id: str) -> bool:
    document = db.query(OutlinerDocument).filter(OutlinerDocument.id == document_id).first()
    if not document:
        return False
    db.delete(document)
    db.commit()
    return True


def fetch_document_by_id(db: Session, document_id: str) -> Optional[OutlinerDocument]:
    return db.query(OutlinerDocument).filter(OutlinerDocument.id == document_id).first()


def set_document_status_and_refresh(
    db: Session, document: OutlinerDocument, status: str
) -> None:
    document.status = status
    document.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(document)


def get_document_progress(
    db: Session, document_id: str
) -> Optional[Dict[str, Any]]:
    document = db.query(OutlinerDocument).filter(OutlinerDocument.id == document_id).first()
    if not document:
        return None
    checked = db.query(func.count(OutlinerSegment.id)).filter(
        OutlinerSegment.document_id == document_id,
        or_(
            OutlinerSegment.status == "checked",
            OutlinerSegment.status == "approved",
        ),
    ).scalar()

    unchecked = db.query(func.count(OutlinerSegment.id)).filter(
        OutlinerSegment.document_id == document_id,
        or_(
            OutlinerSegment.status.is_(None),
            and_(
                OutlinerSegment.status != "checked",
                OutlinerSegment.status != "approved",
            ),
        ),
    ).scalar()

    return {
        "document_id": document_id,
        "checked_segments": checked or 0,
        "unchecked_segments": unchecked or 0,
        "updated_at": document.updated_at,
    }


def reset_segments(db: Session, document_id: str) -> bool:
    document = db.query(OutlinerDocument).filter(OutlinerDocument.id == document_id).first()
    if not document:
        return False
    db.query(OutlinerSegment).filter(OutlinerSegment.document_id == document_id).delete()
    db.commit()
    return True


def replace_segments_and_ai_toc(
    db: Session,
    document: OutlinerDocument,
    db_segments: List[OutlinerSegment],
    normalized_toc: Any,
) -> None:
    db.query(OutlinerSegment).filter(OutlinerSegment.document_id == document.id).delete(
        synchronize_session=False
    )
    if isinstance(normalized_toc, dict):
        document.ai_toc_entries = json.dumps(normalized_toc, ensure_ascii=False)
    else:
        document.ai_toc_entries = normalized_toc
    document.updated_at = datetime.utcnow()
    db.add_all(db_segments)
    db.commit()


def insert_segment(db: Session, db_segment: OutlinerSegment) -> OutlinerSegment:
    db.add(db_segment)
    db.commit()
    db.refresh(db_segment)
    return db_segment


def insert_segments_bulk(db: Session, db_segments: List[OutlinerSegment]) -> None:
    db.add_all(db_segments)
    db.commit()


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


def get_segment_by_pk(db: Session, segment_id: str) -> Optional[OutlinerSegment]:
    return db.get(OutlinerSegment, segment_id)


def document_has_any_segment(db: Session, document_id: str) -> bool:
    return (
        db.query(OutlinerSegment.id)
        .filter(OutlinerSegment.document_id == document_id)
        .first()
        is not None
    )


def add_segment_flush(db: Session, segment: OutlinerSegment) -> None:
    db.add(segment)
    db.flush()


def execute_bump_segment_indices_after(
    db: Session, document_id: str, segment_index: int
) -> None:
    db.execute(
        update(OutlinerSegment)
        .where(
            OutlinerSegment.document_id == document_id,
            OutlinerSegment.segment_index > segment_index,
        )
        .values(segment_index=OutlinerSegment.segment_index + 1)
    )


def add_segment(db: Session, segment: OutlinerSegment) -> None:
    db.add(segment)


def commit_session(db: Session) -> None:
    db.commit()


def fetch_segments_ordered_by_ids(
    db: Session, segment_ids: List[str]
) -> List[OutlinerSegment]:
    return (
        db.query(OutlinerSegment)
        .filter(OutlinerSegment.id.in_(segment_ids))
        .order_by(OutlinerSegment.segment_index)
        .all()
    )


def delete_orm_entity(db: Session, entity: Any) -> None:
    db.delete(entity)


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


def refresh_entity(db: Session, entity: Any) -> None:
    db.refresh(entity)


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


def apply_rejection_to_segment(
    db: Session,
    segment: OutlinerSegment,
    annotator_id: Optional[str],
    reviewer_id: Optional[str],
    reason: str,
) -> None:
    rejection = SegmentRejection(
        id=str(uuid.uuid4()),
        segment_id=segment.id,
        user_id=annotator_id,
        reviewer_id=reviewer_id,
        rejection_reason=reason,
        resolved=False,
    )
    db.add(rejection)
    old_st = segment.status
    apply_segment_review_metadata(segment, old_st, "rejected", None)
    apply_segment_review_title_author_tracking(segment, old_st, "rejected")
    segment.status = "rejected"
    segment.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(segment)


def fetch_segments_by_ids(db: Session, segment_ids: List[str]) -> List[OutlinerSegment]:
    return db.query(OutlinerSegment).filter(OutlinerSegment.id.in_(segment_ids)).all()


def fetch_documents_by_ids(
    db: Session, document_ids: List[str]
) -> List[OutlinerDocument]:
    return db.query(OutlinerDocument).filter(OutlinerDocument.id.in_(document_ids)).all()


def reject_segments_bulk(
    db: Session,
    segment_ids: List[str],
    reviewer_id: Optional[str],
    reason: str,
) -> List[OutlinerSegment]:
    segments = fetch_segments_by_ids(db, segment_ids)
    if not segments:
        raise ValueError("No segments found")
    doc_ids = {seg.document_id for seg in segments}
    documents = fetch_documents_by_ids(db, list(doc_ids))
    doc_user_map = {doc.id: doc.user_id for doc in documents}

    rejected_segments: List[OutlinerSegment] = []
    for segment in segments:
        is_valid, _ = validate_segment_status_transition(segment.status, "rejected")
        if not is_valid:
            continue

        rejection = SegmentRejection(
            id=str(uuid.uuid4()),
            segment_id=segment.id,
            user_id=doc_user_map.get(segment.document_id),
            reviewer_id=reviewer_id,
            rejection_reason=reason,
            resolved=False,
        )
        db.add(rejection)
        old_st = segment.status
        apply_segment_review_metadata(segment, old_st, "rejected", None)
        apply_segment_review_title_author_tracking(segment, old_st, "rejected")
        segment.status = "rejected"
        segment.updated_at = datetime.utcnow()
        rejected_segments.append(segment)

    db.commit()
    for seg in rejected_segments:
        db.refresh(seg)

    return rejected_segments


def commit_and_refresh_segments(db: Session, segments: List[OutlinerSegment]) -> None:
    db.commit()
    for seg in segments:
        db.refresh(seg)


def merge_segments_persist(db: Session, first_segment: OutlinerSegment) -> None:
    db.commit()
    db.refresh(first_segment)


def delete_segment_and_reindex(db: Session, segment: OutlinerSegment) -> None:
    document_id = segment.document_id
    segment_index = segment.segment_index
    db.delete(segment)
    following_segments = fetch_following_segments_by_index(db, document_id, segment_index)
    for seg in following_segments:
        seg.segment_index -= 1
    db.commit()


def update_segment_status_persist(
    db: Session,
    segment: OutlinerSegment,
    status: str,
    reviewer_id: Optional[str] = None,
) -> None:
    old_status = segment.status
    apply_segment_review_metadata(segment, old_status, status, reviewer_id)
    apply_segment_review_title_author_tracking(segment, old_status, status)
    segment.status = status
    segment.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(segment)


def get_segment_comments_list(db: Session, segment_id: str) -> Optional[List[Dict[str, Any]]]:
    segment = get_segment_plain(db, segment_id)
    if not segment:
        return None
    return get_comments_list(segment)


def add_segment_comment_persist(
    db: Session, segment_id: str, content: str, username: str
) -> Optional[List[Dict[str, Any]]]:
    segment = get_segment_plain(db, segment_id)
    if not segment:
        return None
    existing_comments = get_comments_list(segment)
    new_comment = {
        "content": content,
        "username": username,
        "timestamp": datetime.utcnow().isoformat(),
    }
    existing_comments.append(new_comment)
    segment.comment = existing_comments
    flag_modified(segment, "comment")
    segment.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(segment)
    return existing_comments


def update_segment_comment_persist(
    db: Session, segment_id: str, comment_index: int, content: str
) -> Tuple[Optional[List[Dict[str, Any]]], Optional[str]]:
    segment = get_segment_plain(db, segment_id)
    if not segment:
        return None, "segment_not_found"
    comments_list = get_comments_list(segment)
    if comment_index < 0 or comment_index >= len(comments_list):
        return None, "comment_not_found"
    comments_list[comment_index]["content"] = content
    comments_list[comment_index]["timestamp"] = datetime.utcnow().isoformat()
    segment.comment = comments_list
    flag_modified(segment, "comment")
    segment.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(segment)
    return comments_list, None


def delete_segment_comment_persist(
    db: Session, segment_id: str, comment_index: int
) -> Tuple[Optional[List[Dict[str, Any]]], Optional[str]]:
    segment = get_segment_plain(db, segment_id)
    if not segment:
        return None, "segment_not_found"
    comments_list = get_comments_list(segment)
    if comment_index < 0 or comment_index >= len(comments_list):
        return None, "comment_not_found"
    comments_list.pop(comment_index)
    if len(comments_list) == 0:
        segment.comment = None
    else:
        segment.comment = comments_list
        flag_modified(segment, "comment")
    segment.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(segment)
    return comments_list, None


def get_segment_rejection_count(db: Session, segment_id: str) -> int:
    return db.query(func.count(SegmentRejection.id)).filter(
        SegmentRejection.segment_id == segment_id
    ).scalar() or 0


def _latest_rejection_row_per_segment_subquery(db: Session):
    """Row-numbered segment_rejections: rn=1 is the newest row per segment."""
    rn = (
        func.row_number()
        .over(
            partition_by=SegmentRejection.segment_id,
            order_by=SegmentRejection.created_at.desc(),
        )
        .label("rn")
    )
    return (
        db.query(
            SegmentRejection.segment_id.label("segment_id"),
            SegmentRejection.resolved.label("resolved"),
            rn,
        ).subquery()
    )


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
    latest_rej_sq = _latest_rejection_row_per_segment_subquery(db)
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
    doc_query = db.query(OutlinerDocument.id).filter(
        (OutlinerDocument.status != "deleted") | (OutlinerDocument.status.is_(None))
    )
    if user_id:
        doc_query = doc_query.filter(OutlinerDocument.user_id == user_id)
    if start_date:
        doc_query = doc_query.filter(OutlinerDocument.created_at >= start_date)
    if end_date:
        doc_query = doc_query.filter(OutlinerDocument.created_at <= end_date)

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
    segment_unchecked_when = or_(OutlinerSegment.status.is_(None), OutlinerSegment.status == "unchecked") 
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

    latest_rej_sq = _latest_rejection_row_per_segment_subquery(db)
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
    segments_self_reviewed_total = (
        seg_base.join(OutlinerDocument, OutlinerSegment.document_id == OutlinerDocument.id)
        .filter(
            segment_reviewed_or_checked,
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
        "annotation_coverage_pct": annotation_coverage_pct,
        "annotator_performance": annotator_performance,
    }


def bdrc_modified_by_from_document(
    db: Session, document: OutlinerDocument
) -> Optional[str]:
    if not document.user_id:
        return None
    user = db.query(User).filter(User.id == document.user_id).first()
    if not user:
        return None
    email = (user.email or "").strip()
    if email:
        return email
    return (user.id or "").strip() or None


def list_completed_document_ids_all_segments_checked(
    db: Session,
    only_document_ids: Optional[List[str]] = None,
) -> List[str]:
    segment_not_checked = exists().where(
        OutlinerSegment.document_id == OutlinerDocument.id,
        or_(
            OutlinerSegment.status.is_(None),
            OutlinerSegment.status != "checked",
        ),
    )
    has_segments = exists().where(
        OutlinerSegment.document_id == OutlinerDocument.id,
    )
    q = db.query(OutlinerDocument.id).filter(
        OutlinerDocument.status == "completed",
        OutlinerDocument.filename.isnot(None),
        OutlinerDocument.filename != "",
        ~segment_not_checked,
        has_segments,
    )
    if only_document_ids is not None:
        if not only_document_ids:
            return []
        q = q.filter(OutlinerDocument.id.in_(only_document_ids))
    rows = q.all()
    return [r[0] for r in rows]


def map_document_id_to_filename(
    db: Session, document_ids: List[str]
) -> Dict[str, str]:
    id_to_filename: Dict[str, str] = {}
    if not document_ids:
        return id_to_filename
    for row in (
        db.query(OutlinerDocument.id, OutlinerDocument.filename)
        .filter(OutlinerDocument.id.in_(document_ids))
        .all()
    ):
        id_to_filename[row[0]] = (row[1] or "").strip()
    return id_to_filename


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


def bulk_segment_operations_execute(
    db: Session,
    document: OutlinerDocument,
    create: Optional[List[Dict[str, Any]]] = None,
    update: Optional[List[Dict[str, Any]]] = None,
    delete: Optional[List[str]] = None,
) -> List[OutlinerSegment]:
    """Same behavior as former controller bulk_segment_operations DB logic."""
    document_id = document.id
    result_segments: List[OutlinerSegment] = []

    if delete:
        segments_to_delete = fetch_segments_by_ids_for_document(db, delete, document_id)

        if len(segments_to_delete) != len(delete):
            found_ids = {seg.id for seg in segments_to_delete}
            missing_ids = set(delete) - found_ids
            raise ValueError(f"Some segments not found: {list(missing_ids)}")

        deleted_indices = {seg.segment_index for seg in segments_to_delete}
        max_deleted_index = max(deleted_indices) if deleted_indices else -1

        for seg in segments_to_delete:
            db.delete(seg)

        if max_deleted_index >= 0:
            following_segments = db.query(OutlinerSegment).filter(
                OutlinerSegment.document_id == document_id,
                OutlinerSegment.segment_index > max_deleted_index,
            ).all()

            shift_amount = len(segments_to_delete)
            for seg in following_segments:
                seg.segment_index -= shift_amount

    if update:
        segment_updates = {
            update_item.get("id"): update_item for update_item in update if "id" in update_item
        }
        segment_ids_to_update = list(segment_updates.keys())

        segments_to_update = fetch_segments_for_bulk_update(
            db, segment_ids_to_update, document_id
        )

        if len(segments_to_update) != len(segment_ids_to_update):
            found_ids = {seg.id for seg in segments_to_update}
            missing_ids = set(segment_ids_to_update) - found_ids
            raise ValueError(f"Some segments not found for update: {list(missing_ids)}")

        for segment in segments_to_update:
            update_data = segment_updates[segment.id]
            old_status = segment.status

            if "title" in update_data and update_data["title"] is not None:
                segment.title = update_data["title"]
            if "author" in update_data and update_data["author"] is not None:
                segment.author = update_data["author"]
            if "title_bdrc_id" in update_data and update_data["title_bdrc_id"] is not None:
                segment.title_bdrc_id = update_data["title_bdrc_id"]
            if "author_bdrc_id" in update_data and update_data["author_bdrc_id"] is not None:
                segment.author_bdrc_id = update_data["author_bdrc_id"]
            if "parent_segment_id" in update_data and update_data["parent_segment_id"] is not None:
                segment.parent_segment_id = update_data["parent_segment_id"]
            if "is_attached" in update_data and update_data["is_attached"] is not None:
                segment.is_attached = update_data["is_attached"]
            if "status" in update_data and update_data["status"] is not None:
                new_st = update_data["status"]
                prev_st = segment.status
                is_valid, error_msg = validate_segment_status_transition(
                    segment.status, new_st
                )
                if not is_valid:
                    raise ValueError(error_msg)
                apply_segment_review_metadata(
                    segment,
                    prev_st,
                    new_st,
                    update_data.get("reviewer_id"),
                )
                apply_segment_review_title_author_tracking(segment, prev_st, new_st)
                segment.status = new_st
            if "span_start" in update_data and update_data["span_start"] is not None:
                segment.span_start = update_data["span_start"]
            if "span_end" in update_data and update_data["span_end"] is not None:
                segment.span_end = update_data["span_end"]
            if "segment_index" in update_data and update_data["segment_index"] is not None:
                segment.segment_index = update_data["segment_index"]

            segment.update_annotation_status()
            segment.updated_at = datetime.utcnow()
            if old_status == "rejected":
                mark_latest_rejection_resolved(db, segment.id)
            result_segments.append(segment)

    if create:
        max_index = max_segment_index(db, document_id)
        new_segments = []
        for idx, segment_data in enumerate(create):
            segment_index = (
                segment_data.get("segment_index")
                if segment_data.get("segment_index") is not None
                else max_index + idx + 1
            )

            segment_text = segment_data.get("text")
            if not segment_text:
                span_start = segment_data["span_start"]
                span_end = segment_data["span_end"]
                if span_start < 0 or span_end > len(document.content):
                    raise ValueError(
                        f"Invalid span addresses for segment at index {segment_index}"
                    )
                segment_text = document.content[span_start:span_end]

            db_segment = OutlinerSegment(
                id=str(uuid.uuid4()),
                document_id=document_id,
                text="",
                segment_index=segment_index,
                span_start=segment_data["span_start"],
                span_end=segment_data["span_end"],
                title=segment_data.get("title"),
                author=segment_data.get("author"),
                title_bdrc_id=segment_data.get("title_bdrc_id"),
                author_bdrc_id=segment_data.get("author_bdrc_id"),
                parent_segment_id=segment_data.get("parent_segment_id"),
                label=infer_segment_label_for_new_segment(
                    segment_data.get("title"), segment_text
                ),
                status="unchecked",
            )
            db_segment.update_annotation_status()
            new_segments.append(db_segment)
            db.add(db_segment)

        result_segments.extend(new_segments)

    db.commit()

    for seg in result_segments:
        db.refresh(seg)

    return result_segments
