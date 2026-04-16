"""SQLAlchemy data access for outliner_document rows."""
import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, exists, func, not_, or_
from sqlalchemy.orm import Session

from user.models.user import User
from outliner.models.outliner import OutlinerDocument, OutlinerSegment
from outliner.repository.segment import _segment_aggregate_counts_by_document_ids
from outliner.repository.segment_rejection import latest_rejection_notice_by_document_ids


def list_documents(
    db: Session,
    user_id: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    include_deleted: bool = False,
    title: Optional[str] = None,
    exclude_document_user_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    query = db.query(OutlinerDocument)
    if user_id:
        query = query.filter(OutlinerDocument.user_id == user_id)

    if exclude_document_user_id:
        query = query.filter(
            (OutlinerDocument.user_id != exclude_document_user_id)
            | (OutlinerDocument.user_id.is_(None))
        )
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
        notice = latest_rejection_by_doc.get(doc.id)
        if (doc.status or "") not in ("approved", "completed"):
            notice = None
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
                "rejected_segment": notice,
            }
        )

    return result


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


def fetch_documents_by_ids(
    db: Session, document_ids: List[str]
) -> List[OutlinerDocument]:
    return db.query(OutlinerDocument).filter(OutlinerDocument.id.in_(document_ids)).all()


def set_document_status_and_refresh(
    db: Session, document: OutlinerDocument, status: str
) -> None:
    document.status = status
    document.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(document)


def increment_document_submit_count(db: Session, document_id: str) -> None:
    """Bump review submit counter when admin approves the full document (POST .../approve)."""
    document = db.query(OutlinerDocument).filter(OutlinerDocument.id == document_id).first()
    if not document:
        return
    document.submit_count = (document.submit_count or 0) + 1
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
    document.status = "active"
    document.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(document)
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


def allow_user_to_assign_volume(db: Session, user_id: str) -> bool:
    """
    Returns True when the user may request a new volume assignment.

    Rules (documents are those with ``user_id`` set to this user):
    - If the user has no such documents, they are allowed.
    - No document may have status ``active``.
    - Every document must have status one of: skipped, completed, approved, deleted
      (including non-null; unknown or null status blocks assignment).
    - If any segment on any of those documents is ``rejected``, assignment is blocked.
    - For documents with status ``completed`` or ``approved``, every segment must be
      ``checked`` or ``approved``. Skipped or deleted documents do not require that
      segment-level completion check.
    """
    allowed_doc_statuses = ("skipped", "completed", "approved", "deleted")

    has_any = (
        db.query(OutlinerDocument.id)
        .filter(OutlinerDocument.user_id == user_id)
        .first()
    )
    if has_any is None:
        return True

    if (
        db.query(OutlinerDocument.id)
        .filter(OutlinerDocument.user_id == user_id, OutlinerDocument.status == "active")
        .first()
    ):
        return False

    bad_doc_status = (
        db.query(OutlinerDocument.id)
        .filter(
            OutlinerDocument.user_id == user_id,
            or_(
                OutlinerDocument.status.is_(None),
                OutlinerDocument.status.notin_(allowed_doc_statuses),
            ),
        )
        .first()
    )
    if bad_doc_status is not None:
        return False

    if (
        db.query(OutlinerSegment.id)
        .join(OutlinerDocument, OutlinerSegment.document_id == OutlinerDocument.id)
        .filter(
            OutlinerDocument.user_id == user_id,
            OutlinerSegment.status == "rejected",
        )
        .first()
    ): 
        return False

    incomplete_on_finished = (
        db.query(OutlinerSegment.id)
        .join(OutlinerDocument, OutlinerSegment.document_id == OutlinerDocument.id)
        .filter(
            OutlinerDocument.user_id == user_id,
            OutlinerDocument.status=="completed",
            or_(
                OutlinerSegment.status.is_(None),
                OutlinerSegment.status.notin_(("checked", "approved")),
            ),
        )
        .first()
    )
    if incomplete_on_finished is not None:
        return False
    return incomplete_on_finished is None


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
