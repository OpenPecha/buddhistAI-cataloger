"""SQLAlchemy data access for outliner_segment rows."""
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, case, func, or_, update
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.orm.attributes import flag_modified

from outliner.models.outliner import OutlinerDocument, OutlinerSegment, SegmentRejection
from outliner.repository.segment_review import (
    apply_segment_review_metadata,
    apply_segment_review_title_author_tracking,
)
from outliner.repository.segment_rejection import (
    mark_latest_rejection_resolved,
    update_segment_with_rejection_fields,
)
from outliner.utils.outliner_utils import (
    get_comments_list,
    infer_segment_label_for_new_segment,
    validate_segment_status_transition,
)


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


def fetch_segments_by_ids(db: Session, segment_ids: List[str]) -> List[OutlinerSegment]:
    return db.query(OutlinerSegment).filter(OutlinerSegment.id.in_(segment_ids)).all()


def reject_segments_bulk(
    db: Session,
    segment_ids: List[str],
    reviewer_id: Optional[str],
    reason: str,
) -> List[OutlinerSegment]:
    from outliner.repository import document as document_repo

    segments = fetch_segments_by_ids(db, segment_ids)
    if not segments:
        raise ValueError("No segments found")
    doc_ids = {seg.document_id for seg in segments}
    documents = document_repo.fetch_documents_by_ids(db, list(doc_ids))
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
