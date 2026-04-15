"""
Controller for outliner document and segment operations.
"""
import json
import logging
import uuid
from pathlib import Path
from types import SimpleNamespace
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session
from outliner.models.outliner import OutlinerDocument, OutlinerSegment, SegmentLabels
from outliner.repository import outliner_repository as outliner_repo
from outliner.utils.segment_title_author_auto import (
    apply_auto_title_to_segment,
    apply_split_auto_title_author_parallel,
)
from core.redis import invalidate_document_content_cache
from outliner.utils.outliner_utils import (
    get_document_with_cache,
    incremental_update_document_progress,
    get_annotation_status_delta,
    get_comments_list,
    infer_segment_label_for_new_segment,
    resolve_document_content,
    segment_body_from_document,
    set_document_content_in_cache,
    validate_segment_status_transition,
)

logger = logging.getLogger(__name__)

# BDRC bulk sync progress: append-only log next to backend package (backend/sync_status.txt).
_SYNC_STATUS_LOG_PATH = Path(__file__).resolve().parents[2] / "sync_status.txt"


def _bdrc_bulk_sync_file_logger() -> logging.Logger:
    """Logger that writes BDRC bulk sync progress to sync_status.txt (handlers attached once)."""
    log = logging.getLogger("outliner.bdrc_bulk_sync_status")
    log.setLevel(logging.INFO)
    if not log.handlers:
        fh = logging.FileHandler(_SYNC_STATUS_LOG_PATH, encoding="utf-8", mode="a")
        fh.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
        )
        log.addHandler(fh)
    log.propagate = False
    return log


# ==================== Document Operations ====================

def create_document(
    db: Session,
    content: str,
    filename: Optional[str] = None,
    user_id: Optional[str] = None
) -> OutlinerDocument:
    """Create a new outliner document with full text content"""
    db_document = outliner_repo.insert_document(db, content, filename, user_id)
    set_document_content_in_cache(db_document.id, db_document.content)
    return db_document



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
    """
    List all outliner documents, optionally filtered by user, status, and deletion status.

    Args:
        db: Database session
        user_id: Filter documents by user ID
        status: Filter documents by status (active, completed, approved, etc.)
        skip: Number of documents to skip (pagination)
        limit: Maximum number of documents to return
        include_deleted: If False (default), exclude deleted documents. If True, include all documents.
        title: If set, case-insensitive substring match on document filename (list UI title).
        exclude_document_user_id: If set, omit documents whose owner/assignee user_id equals this value.
    """
    return outliner_repo.list_documents(
        db,
        user_id=user_id,
        status=status,
        skip=skip,
        limit=limit,
        include_deleted=include_deleted,
        title=title,
        exclude_document_user_id=exclude_document_user_id,
    )


def none_check(raw: Optional[str],error_message:str) -> str:
    if raw is None or not str(raw).strip():
        raise HTTPException(status_code=422, detail=error_message)
    return str(raw).strip()


def update_segment_with_rejection_fields(db: Session, segment_list: List[dict]) -> None:
    """Attach nested `rejection` onto segment_list dicts (annotator document payload)."""
    outliner_repo.update_segment_with_rejection_fields(db, segment_list)


def latest_rejection_reason_for_orm_segment(
    db: Optional[Session], segment: OutlinerSegment
) -> Optional[str]:
    """Reason from the most recent rejection row, only meaningful when status is rejected."""
    return outliner_repo.latest_rejection_reason_for_orm_segment(db, segment)


def latest_rejection_reviewer_for_orm_segment(
    db: Optional[Session], segment: OutlinerSegment
) -> Optional[Dict[str, Any]]:
    """Reviewer profile from users via latest segment_rejections.reviewer_id → users.id."""
    return outliner_repo.latest_rejection_reviewer_for_orm_segment(db, segment)


def latest_rejection_resolved_for_orm_segment(
    db: Optional[Session], segment: OutlinerSegment
) -> Optional[bool]:
    """`resolved` on the latest segment_rejections row (annotator addressed reviewer feedback)."""
    return outliner_repo.latest_rejection_resolved_for_orm_segment(db, segment)


def get_document(
    db: Session,
    document_id: str,
    include_segments: bool = True
) -> OutlinerDocument:
    """Get a document by ID with all its segments"""
    document = get_document_with_cache(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if include_segments:
        document.segment_list = outliner_repo.segment_list_for_document(db, document_id)

    return document


def get_document_for_workspace(
    db: Session,
    document_id: str,
    include_segments: bool = True,
) -> SimpleNamespace:
    """
    Annotator workspace: minimal document columns (id, filename, status) plus content from
    Redis when available, otherwise a single read of the content column (not the full ORM row).
    Segments are loaded only from outliner_segments for this document_id.
    """
    row = outliner_repo.fetch_document_workspace_row(db, document_id)
    if not row:
        raise HTTPException(status_code=404, detail="Document not found")

    content = resolve_document_content(db, document_id)
    if content is None:
        raise HTTPException(status_code=404, detail="Document not found")

    segment_list: List[dict] = (
        outliner_repo.segment_list_for_document(db, document_id) if include_segments else []
    )

    return SimpleNamespace(
        id=row.id,
        filename=row.filename,
        status=row.status,
        content=content,
        segment_list=segment_list,
    )

def get_document_by_filename(db: Session, filename: str) -> OutlinerDocument:
    """Get a document by filename"""
    document = outliner_repo.fetch_document_by_filename(db, filename)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document

def update_document_content(
    db: Session,
    document_id: str,
    content: str
) -> Dict[str, str]:
    """Update the full text content of a document"""
    if not outliner_repo.update_document_content(db, document_id, content):
        raise HTTPException(status_code=404, detail="Document not found")

    invalidate_document_content_cache(document_id)
    set_document_content_in_cache(document_id, content)
    
    return {"message": "Document content updated", "document_id": document_id}


def normalize_ai_toc_for_storage(entries: Any) -> Optional[Any]:
    """
    Normalize TOC payload for JSON storage.

    Accepts:
    - dict mapping title (str) -> page number (int), optionally JSON-serialized as a string
    - list of title strings (legacy: page numbers are assigned when serving the API)
    - list of dicts with title + page_no (or page)
    """
    if entries is None:
        return None
    if isinstance(entries, str):
        s = entries.strip()
        if not s:
            return None
        try:
            return normalize_ai_toc_for_storage(json.loads(s))
        except json.JSONDecodeError:
            return [s]
    if isinstance(entries, dict):
        out: Dict[str, int] = {}
        for k, v in entries.items():
            title = str(k).strip()
            if not title:
                continue
            try:
                out[title] = int(v)
            except (TypeError, ValueError):
                continue
        return out if out else None
    if isinstance(entries, (list, tuple)):
        if not entries:
            return None
        first = entries[0]
        if isinstance(first, dict):
            out_map: Dict[str, int] = {}
            for el in entries:
                if not isinstance(el, dict):
                    continue
                tit = el.get("title")
                pn = el.get("page_no", el.get("page"))
                if tit is None or pn is None:
                    continue
                try:
                    out_map[str(tit).strip()] = int(pn)
                except (TypeError, ValueError):
                    continue
            return out_map if out_map else None
        lines = [str(x).strip() for x in entries if str(x).strip()]
        return lines if lines else None
    return None


def ai_toc_db_value_to_api_items(raw: Any) -> List[Dict[str, Any]]:
    """Turn stored ``ai_toc_entries`` into sorted ``[{page_no, title}, ...]`` for the API."""
    if raw is None:
        return []
    if isinstance(raw, str):
        s = raw.strip()
        if not s:
            return []
        try:
            return ai_toc_db_value_to_api_items(json.loads(s))
        except json.JSONDecodeError:
            return [{"page_no": 1, "title": s}]
    if isinstance(raw, dict):
        items: List[Dict[str, Any]] = []
        for title, page in raw.items():
            t = str(title).strip()
            if not t:
                continue
            try:
                items.append({"page_no": int(page), "title": t})
            except (TypeError, ValueError):
                continue
        items.sort(key=lambda x: (x["page_no"], x["title"]))
        return items
    if isinstance(raw, (list, tuple)):
        if not raw:
            return []
        if isinstance(raw[0], dict):
            out: List[Dict[str, Any]] = []
            for el in raw:
                if not isinstance(el, dict):
                    continue
                pn = el.get("page_no", el.get("page"))
                tit = el.get("title", el.get("name"))
                if pn is None or tit is None:
                    continue
                try:
                    out.append({"page_no": int(pn), "title": str(tit).strip()})
                except (TypeError, ValueError):
                    continue
            out.sort(key=lambda x: (x["page_no"], x["title"]))
            return out
        result: List[Dict[str, Any]] = []
        for i, s in enumerate(raw):
            t = str(s).strip()
            if t:
                result.append({"page_no": i + 1, "title": t})
        return result
    return []




def get_document_ai_toc_entries(
    db: Session,
    document_id: str,
) -> Any:
    """Return raw stored ``ai_toc_entries`` (dict, list, or JSON string)."""
    document = outliner_repo.fetch_document_by_id(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document.ai_toc_entries


def delete_document(db: Session, document_id: str) -> None:
    """Delete a document and all its segments"""
    if not outliner_repo.delete_document(db, document_id):
        raise HTTPException(status_code=404, detail="Document not found")
    invalidate_document_content_cache(document_id)


def update_document_status(
    db: Session,
    document_id: str,
    status: str,
    user_id: Optional[str] = None
) -> Dict[str, str]:
    """
    Update document status.
    
    When restoring a deleted document (changing status from 'deleted' to 'active'),
    the user_id parameter must be provided and must match the document's user_id
    to ensure only the document owner can restore it.
    """
    # Validate status value
    valid_statuses = ['active', 'completed', 'deleted', 'approved', 'rejected','skipped']
    if status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Status must be one of: {', '.join(valid_statuses)}"
        )
    
    document = outliner_repo.fetch_document_by_id(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # If restoring a deleted document (changing to 'active'), verify ownership
    if document.status == 'deleted' and status == 'active':
        if not user_id:
            raise HTTPException(
                status_code=400,
                detail="user_id parameter is required to restore a deleted document"
            )
        if document.user_id != user_id:
            raise HTTPException(
                status_code=403,
                detail="You can only restore documents that belong to you"
            )
    
    outliner_repo.set_document_status_and_refresh(db, document, status)

    return {"message": "Document status updated", "document_id": document_id, "status": status}


def get_document_progress(db: Session, document_id: str) -> Dict[str, Any]:
    """Get progress statistics for a document"""
    data = outliner_repo.get_document_progress(db, document_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return data


def reset_segments(db: Session, document_id: str) -> None:
    """Delete all segments for a document"""
    if not outliner_repo.reset_segments(db, document_id):
        raise HTTPException(status_code=404, detail="Document not found")


def segment_orm_to_document_response_dict(seg: OutlinerSegment) -> Dict[str, Any]:
    """Flat dict for SegmentResponseDocument (stable across commit / session expiry)."""
    return {
        "id": seg.id,
        "segment_index": seg.segment_index,
        "span_start": seg.span_start,
        "span_end": seg.span_end,
        "title": seg.title,
        "author": seg.author,
        "title_span_start": seg.title_span_start,
        "title_span_end": seg.title_span_end,
        "updated_title": seg.updated_title,
        "author_span_start": seg.author_span_start,
        "author_span_end": seg.author_span_end,
        "updated_author": seg.updated_author,
        "reviewer_title": seg.reviewer_title,
        "reviewer_author": seg.reviewer_author,
        "title_bdrc_id": seg.title_bdrc_id,
        "author_bdrc_id": seg.author_bdrc_id,
        "parent_segment_id": seg.parent_segment_id,
        "is_annotated": seg.is_annotated,
        "is_attached": seg.is_attached,
        "status": seg.status,
        "label": seg.label.name if seg.label else None,
        "is_supplied_title": seg.is_supplied_title,
    }


def _segment_orms_from_bulk_data(
    document_id: str,
    document_content: str,
    segments_data: List[Dict[str, Any]],
) -> List[OutlinerSegment]:
    """Build OutlinerSegment instances for bulk insert (not yet added to the session)."""
    db_segments: List[OutlinerSegment] = []
    for segment_data in segments_data:
        segment_text = segment_data.get("text")
        if not segment_text:
            span_start = segment_data["span_start"]
            span_end = segment_data["span_end"]
            if span_start < 0 or span_end > len(document_content):
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid span addresses for segment at index {segment_data['segment_index']}",
                )
            segment_text = document_content[span_start:span_end]

        title_val = segment_data.get("title")
        label = infer_segment_label_for_new_segment(title_val, segment_text)
        db_segment = OutlinerSegment(
            id=str(uuid.uuid4()),
            document_id=document_id,
            text="",
            segment_index=segment_data["segment_index"],
            span_start=segment_data["span_start"],
            span_end=segment_data["span_end"],
            title=title_val,
            label=label,
            author=segment_data.get("author"),
            title_bdrc_id=segment_data.get("title_bdrc_id"),
            author_bdrc_id=segment_data.get("author_bdrc_id"),
            parent_segment_id=segment_data.get("parent_segment_id"),
            status="unchecked",
        )
        db_segment.update_annotation_status()
        db_segments.append(db_segment)
    return db_segments


def replace_document_segments_and_ai_toc(
    db: Session,
    document_id: str,
    segments_data: List[Dict[str, Any]],
    toc_entries: Any,
) -> Tuple[OutlinerDocument, List[Dict[str, Any]]]:
    """
    Delete all segments, insert new ones, and update AI TOC in a single transaction.
    Avoids multiple commits and a full document re-fetch after outline generation.
    """
    document = get_document_with_cache(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    normalized = normalize_ai_toc_for_storage(toc_entries)
    db_segments = _segment_orms_from_bulk_data(document_id, document.content, segments_data)
    segment_payload = [segment_orm_to_document_response_dict(s) for s in db_segments]
    outliner_repo.replace_segments_and_ai_toc(db, document, db_segments, normalized)
    return document, segment_payload


# ==================== Segment Operations ====================

def create_segment(
    db: Session,
    document_id: str,
    segment_index: int,
    span_start: int,
    span_end: int,
    text: Optional[str] = None,
    title: Optional[str] = None,
    author: Optional[str] = None,
    title_bdrc_id: Optional[str] = None,
    author_bdrc_id: Optional[str] = None,
    parent_segment_id: Optional[str] = None
) -> OutlinerSegment:
    """Create a new segment in a document"""
    # Verify document exists and get content from cache if available
    document = get_document_with_cache(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if span_start < 0 or span_end > len(document.content):
        raise HTTPException(status_code=400, detail="Invalid span addresses")
    segment_text = segment_body_from_document(document.content, span_start, span_end)

    db_segment = OutlinerSegment(
        id=str(uuid.uuid4()),
        document_id=document_id,
        text="",
        segment_index=segment_index,
        span_start=span_start,
        span_end=span_end,
        title=title,
        author=author,
        title_bdrc_id=title_bdrc_id,
        author_bdrc_id=author_bdrc_id,
        parent_segment_id=parent_segment_id,
        label=infer_segment_label_for_new_segment(title, segment_text),
        status='unchecked'  # Default to unchecked
    )
    db_segment.update_annotation_status()

    return outliner_repo.insert_segment(db, db_segment)


def create_segments_bulk(
    db: Session,
    document_id: str,
    segments_data: List[Dict[str, Any]]
) -> List[OutlinerSegment]:
    """Create multiple segments at once"""
    document = get_document_with_cache(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    db_segments = _segment_orms_from_bulk_data(document_id, document.content, segments_data)
    outliner_repo.insert_segments_bulk(db, db_segments)
    return db_segments


def list_segments(db: Session, document_id: str) -> List[OutlinerSegment]:
    """Get all segments for a document"""
    return outliner_repo.list_segments(db, document_id)


def get_segment(db: Session, segment_id: str) -> OutlinerSegment:
    """Get a single segment by ID"""
    segment = outliner_repo.get_segment_with_rejections(db, segment_id)
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    return segment


def update_segment(
    db: Session,
    segment_id: str,
    patch: Dict[str, Any],
) -> OutlinerSegment:
    """
    PERFORMANCE OPTIMIZED: Update a segment's content or annotations.

    ``patch`` is a partial update (e.g. from Pydantic ``model_dump(exclude_unset=True)``).
    Keys present in ``patch`` are applied, including explicit nulls to clear nullable fields.

    Optimizations:
    1. Single SELECT to get segment (with old annotation status)
    2. Incremental document progress update (no COUNT queries)
    3. Avoid db.refresh() by using already-updated ORM object
    4. Single transaction commit
    """
    segment = outliner_repo.get_segment_plain(db, segment_id)
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    old_status = segment.status
    old_label = segment.label

    # Track old annotation status for incremental update
    old_is_annotated = segment.is_annotated
    document_id = segment.document_id  # Store before updates

    if "title" in patch:
        segment.title = patch["title"]
    if "author" in patch:
        segment.author = patch["author"]
    if "title_bdrc_id" in patch:
        segment.title_bdrc_id = patch["title_bdrc_id"]
    if "author_bdrc_id" in patch:
        segment.author_bdrc_id = patch["author_bdrc_id"]
    if "parent_segment_id" in patch:
        segment.parent_segment_id = patch["parent_segment_id"]
    if "is_attached" in patch:
        segment.is_attached = patch["is_attached"]
    if "comment" in patch:
        # Backward compatibility: if old comment format is used, convert to new format
        segment.comment = patch["comment"]
    # Handle new comment format: append comment with username
    if patch.get("comment_content") is not None and patch.get("comment_username") is not None:
        # Get existing comments using helper function
        existing_comments = get_comments_list(segment)

        # Append new comment
        new_comment = {
            "content": patch["comment_content"],
            "username": patch["comment_username"],
            "timestamp": datetime.utcnow().isoformat()
        }
        existing_comments.append(new_comment)

        # Store as array directly
        segment.comment = existing_comments
    if "status" in patch:
        status = patch["status"]
        prev_status = segment.status
        is_valid, error_msg = validate_segment_status_transition(segment.status, status)
        if not is_valid:
            raise HTTPException(status_code=422, detail=error_msg)
        outliner_repo.apply_segment_review_metadata(
            segment,
            prev_status,
            status,
            patch.get("reviewer_id"),
        )
        outliner_repo.apply_segment_review_title_author_tracking(
            segment, prev_status, status
        )
        segment.status = status
    if "label" in patch:
        label = patch["label"]
        if label is not None:
            try:
                segment.label = SegmentLabels[label]
            except KeyError:
                raise HTTPException(
                    status_code=422,
                    detail=f"Invalid label. Must be one of: {', '.join(s.name for s in SegmentLabels)}"
                )
        else:
            segment.label = None
    if "is_supplied_title" in patch:
        segment.is_supplied_title = patch["is_supplied_title"]
    if "title_span_start" in patch:
        segment.title_span_start = patch["title_span_start"]
    if "title_span_end" in patch:
        segment.title_span_end = patch["title_span_end"]
    if "updated_title" in patch:
        segment.updated_title = patch["updated_title"]
    if "author_span_start" in patch:
        segment.author_span_start = patch["author_span_start"]
    if "author_span_end" in patch:
        segment.author_span_end = patch["author_span_end"]
    if "updated_author" in patch:
        segment.updated_author = patch["updated_author"]
    if "reviewer_title" in patch:
        segment.reviewer_title = patch["reviewer_title"]
    if "reviewer_author" in patch:
        segment.reviewer_author = patch["reviewer_author"]

    # Server-side title/author when label becomes TEXT (no extra client PUT)
    label_became_text = (
        "label" in patch
        and patch.get("label") == "TEXT"
        and old_label != SegmentLabels.TEXT
    )
    user_nonempty_title = (
        "title" in patch
        and patch.get("title") is not None
        and str(patch.get("title")).strip() != ""
    )
    # Title only when label becomes TEXT (author runs when a following segment is created, e.g. split)
    if label_became_text and not user_nonempty_title:
        apply_auto_title_to_segment(db, segment)

    # Update annotation status flag
    segment.update_annotation_status()
    new_is_annotated = segment.is_annotated
    segment.updated_at = datetime.utcnow()
    
    # PERFORMANCE FIX #2: Incremental progress update (no COUNT queries)
    # Only update document progress if annotation status actually changed
    annotated_delta = get_annotation_status_delta(old_is_annotated, new_is_annotated)
    if annotated_delta != 0:
        incremental_update_document_progress(
            db=db,
            document_id=document_id,
            total_delta=0,  # No change in total count for updates
            annotated_delta=annotated_delta
        )

    if old_status == "rejected":
        outliner_repo.mark_latest_rejection_resolved(db, segment_id)

    return segment


def update_segments_bulk(
    db: Session,
    segment_updates: List[Dict[str, Any]],
    segment_ids: List[str]
) -> List[OutlinerSegment]:
    """Update multiple segments at once"""
    if len(segment_updates) != len(segment_ids):
        raise HTTPException(
            status_code=400,
            detail="Number of segments must match number of segment_ids"
        )
    
    updated_segments = []
    document_ids = set()
    
    for segment_id, segment_update in zip(segment_ids, segment_updates):
        segment = outliner_repo.get_segment_plain(db, segment_id)
        if not segment:
            continue

        old_status = segment.status
        old_label = segment.label
        
        document_ids.add(segment.document_id)
        
        if 'title' in segment_update:
            segment.title = segment_update['title']
        if 'author' in segment_update:
            segment.author = segment_update['author']
        if 'title_bdrc_id' in segment_update:
            segment.title_bdrc_id = segment_update['title_bdrc_id']
        if 'author_bdrc_id' in segment_update:
            segment.author_bdrc_id = segment_update['author_bdrc_id']
        if 'parent_segment_id' in segment_update:
            segment.parent_segment_id = segment_update['parent_segment_id']
        if 'is_attached' in segment_update:
            segment.is_attached = segment_update['is_attached']
        if 'status' in segment_update:
            new_st = segment_update['status']
            prev_st = segment.status
            is_valid, _ = validate_segment_status_transition(segment.status, new_st)
            if not is_valid:
                continue
            outliner_repo.apply_segment_review_metadata(
                segment,
                prev_st,
                new_st,
                segment_update.get('reviewer_id'),
            )
            outliner_repo.apply_segment_review_title_author_tracking(
                segment, prev_st, new_st
            )
            segment.status = new_st
        if 'label' in segment_update:
            lbl = segment_update['label']
            if lbl is not None:
                try:
                    segment.label = SegmentLabels[lbl]
                except KeyError:
                    pass
            else:
                segment.label = None
        if 'is_supplied_title' in segment_update:
            segment.is_supplied_title = segment_update['is_supplied_title']
        for span_key in (
            'title_span_start', 'title_span_end', 'updated_title',
            'author_span_start', 'author_span_end', 'updated_author',
        ):
            if span_key in segment_update:
                setattr(segment, span_key, segment_update[span_key])
        if 'reviewer_title' in segment_update:
            segment.reviewer_title = segment_update['reviewer_title']
        if 'reviewer_author' in segment_update:
            segment.reviewer_author = segment_update['reviewer_author']

        label_became_text = (
            'label' in segment_update
            and segment.label == SegmentLabels.TEXT
            and old_label != SegmentLabels.TEXT
        )
        user_nonempty_title = (
            'title' in segment_update
            and segment_update.get('title') is not None
            and str(segment_update.get('title')).strip() != ''
        )
        if label_became_text and not user_nonempty_title:
            apply_auto_title_to_segment(db, segment)

        segment.update_annotation_status()
        segment.updated_at = datetime.utcnow()
        if old_status == "rejected":
            outliner_repo.mark_latest_rejection_resolved(db, segment.id)
        updated_segments.append(segment)

    outliner_repo.commit_and_refresh_segments(db, updated_segments)

    return updated_segments


def split_segment(
    db: Session,
    segment_id: str,
    split_position: int,
    document_id: Optional[str] = None
) -> List[OutlinerSegment]:
    """Split a segment at a given position"""
    segment = outliner_repo.get_segment_by_pk(db, segment_id)

    # If segment doesn't exist, check if we need to create initial segment from document
    if not segment:
        if not document_id:
            raise HTTPException(status_code=404, detail="Segment not found")

        document = get_document_with_cache(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        if outliner_repo.document_has_any_segment(db, document_id):
            raise HTTPException(status_code=404, detail="Segment not found")

        if not document.content or len(document.content.strip()) == 0:
            raise HTTPException(status_code=400, detail="Document has no content to split")

        segment = OutlinerSegment(
            id=str(uuid.uuid4()),
            document_id=document_id,
            text="",
            segment_index=0,
            span_start=0,
            span_end=len(document.content),
            title=None,
            author=None,
            parent_segment_id=None,
            label=SegmentLabels.FRONT_MATTER,
            status='unchecked',
        )
        segment.update_annotation_status()
        outliner_repo.add_segment_flush(db, segment)

    doc_for_body = get_document_with_cache(db, segment.document_id)
    if not doc_for_body:
        raise HTTPException(status_code=404, detail="Document not found")
    content = doc_for_body.content or ""
    body = segment_body_from_document(content, segment.span_start, segment.span_end)

    # IMPORTANT: Do not strip/trim. split_position is a character offset within the segment body
    # (slice of document.content [span_start, span_end)).
    if split_position <= 0 or split_position >= len(body):
        raise HTTPException(status_code=400, detail="Invalid split position")

    old_span_start = segment.span_start
    old_span_end = segment.span_end
    new_first_span_end = old_span_start + split_position

    # Safety check: split position must fall within the segment span
    if new_first_span_end < old_span_start or new_first_span_end > old_span_end:
        raise HTTPException(status_code=400, detail="Invalid split position for segment span")

    text_before = body[:split_position]
    text_after = body[split_position:]

    # Update first segment (preserve whitespace/newlines; update span_end using split_position)
    segment.text = ""
    segment.span_end = new_first_span_end
    upper_label = infer_segment_label_for_new_segment(segment.title, text_before)
    lower_label = infer_segment_label_for_new_segment(None, text_after)
    if lower_label == SegmentLabels.TOC or upper_label == SegmentLabels.FRONT_MATTER:
        segment.label = SegmentLabels.FRONT_MATTER
    label = lower_label

    # Create second segment
    new_segment = OutlinerSegment(
        id=str(uuid.uuid4()),
        document_id=segment.document_id,
        text="",
        segment_index=segment.segment_index + 1,
        span_start=new_first_span_end,
        span_end=old_span_end,
        title=None,
        author=None,        
        label=label,
        parent_segment_id=segment.parent_segment_id,
        status=segment.status or 'unchecked'
    )

    outliner_repo.execute_bump_segment_indices_after(
        db, segment.document_id, segment.segment_index
    )

    outliner_repo.add_segment(db, new_segment)
    # Upper title + upper author + lower title: independent Gemini calls, run concurrently
    apply_split_auto_title_author_parallel(segment, new_segment, text_before, text_after)
    segment.update_annotation_status()
    new_segment.update_annotation_status()
    outliner_repo.commit_session(db)

    return [segment, new_segment]


def merge_segments(
    db: Session,
    segment_ids: List[str]
) -> OutlinerSegment:
    """Merge multiple segments into one"""
    if len(segment_ids) < 2:
        raise HTTPException(status_code=400, detail="At least 2 segments required for merge")
    
    segments = outliner_repo.fetch_segments_ordered_by_ids(db, segment_ids)
    
    if len(segments) != len(segment_ids):
        raise HTTPException(status_code=404, detail="One or more segments not found")
    
    # Check all segments belong to same document
    document_id = segments[0].document_id
    if not all(seg.document_id == document_id for seg in segments):
        raise HTTPException(status_code=400, detail="All segments must belong to same document")
    
    # Merge spans and metadata (body text lives on OutlinerDocument.content only)
    merged_title = next((seg.title for seg in segments if seg.title), None)
    merged_author = next((seg.author for seg in segments if seg.author), None)
    merged_title_bdrc_id = next((seg.title_bdrc_id for seg in segments if seg.title_bdrc_id), None)
    merged_author_bdrc_id = next((seg.author_bdrc_id for seg in segments if seg.author_bdrc_id), None)
    merged_parent_id = segments[0].parent_segment_id
    
    # Update first segment with merged data
    first_segment = segments[0]
    first_segment.text = ""
    first_segment.span_end = segments[-1].span_end
    first_segment.title = merged_title
    first_segment.author = merged_author
    first_segment.title_bdrc_id = merged_title_bdrc_id
    first_segment.author_bdrc_id = merged_author_bdrc_id
    first_segment.parent_segment_id = merged_parent_id
    first_segment.update_annotation_status()
    
    # Get IDs of segments to be deleted (all except the first)
    segments_to_delete_ids = [seg.id for seg in segments[1:]]
    
    for seg in segments[1:]:
        outliner_repo.delete_orm_entity(db, seg)

    following_segments = outliner_repo.fetch_following_segments_excluding_ids(
        db, document_id, first_segment.segment_index, segments_to_delete_ids
    )

    shift_amount = len(segments) - 1
    for seg in following_segments:
        seg.segment_index -= shift_amount

    outliner_repo.merge_segments_persist(db, first_segment)

    return first_segment


def delete_segment(db: Session, segment_id: str) -> None:
    """Delete a segment"""
    segment = outliner_repo.get_segment_plain(db, segment_id)
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    outliner_repo.delete_segment_and_reindex(db, segment)


def update_segment_status(
    db: Session,
    segment_id: str,
    status: str,
    reviewer_id: Optional[str] = None,
) -> Dict[str, str]:
    """Update segment status with transition validation"""
    segment = outliner_repo.get_segment_plain(db, segment_id)
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    old_status = segment.status
    is_valid, error_msg = validate_segment_status_transition(segment.status, status)
    if not is_valid:
        raise HTTPException(status_code=422, detail=error_msg)

    outliner_repo.update_segment_status_persist(db, segment, status, reviewer_id)

    if old_status == "rejected":
        outliner_repo.mark_latest_rejection_resolved(db, segment_id)

    return {"message": "Segment status updated", "segment_id": segment_id, "status": status}


def bulk_segment_operations(
    db: Session,
    document_id: str,
    create: Optional[List[Dict[str, Any]]] = None,
    update: Optional[List[Dict[str, Any]]] = None,
    delete: Optional[List[str]] = None
) -> List[OutlinerSegment]:
    """
    Perform bulk operations on segments: create, update, and delete in a single transaction.
    This is optimized for performance by batching all operations together.
    """
    # Verify document exists and get content from cache if available
    document = get_document_with_cache(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    try:
        return outliner_repo.bulk_segment_operations_execute(
            db, document, create=create, update=update, delete=delete
        )
    except ValueError as e:
        msg = str(e)
        if "Invalid span addresses" in msg:
            raise HTTPException(status_code=400, detail=msg) from e
        if "not found" in msg.lower():
            raise HTTPException(status_code=404, detail=msg) from e
        raise HTTPException(status_code=422, detail=msg) from e


# ==================== Comment Operations ====================

def get_segment_comments(db: Session, segment_id: str) -> List[Dict[str, Any]]:
    """Get all comments for a segment"""
    comments_list = outliner_repo.get_segment_comments_list(db, segment_id)
    if comments_list is None:
        raise HTTPException(status_code=404, detail="Segment not found")
    return comments_list


def add_segment_comment(
    db: Session,
    segment_id: str,
    content: str,
    username: str
) -> List[Dict[str, Any]]:
    """Add a comment to a segment"""
    existing_comments = outliner_repo.add_segment_comment_persist(
        db, segment_id, content, username
    )
    if existing_comments is None:
        raise HTTPException(status_code=404, detail="Segment not found")
    return existing_comments


def update_segment_comment(
    db: Session,
    segment_id: str,
    comment_index: int,
    content: str
) -> List[Dict[str, Any]]:
    """Update a specific comment by index"""
    comments_list, err = outliner_repo.update_segment_comment_persist(
        db, segment_id, comment_index, content
    )
    if err == "segment_not_found":
        raise HTTPException(status_code=404, detail="Segment not found")
    if err == "comment_not_found":
        raise HTTPException(status_code=404, detail="Comment not found")
    return comments_list or []


def delete_segment_comment(
    db: Session,
    segment_id: str,
    comment_index: int
) -> List[Dict[str, Any]]:
    """Delete a specific comment by index"""
    comments_list, err = outliner_repo.delete_segment_comment_persist(
        db, segment_id, comment_index
    )
    if err == "segment_not_found":
        raise HTTPException(status_code=404, detail="Segment not found")
    if err == "comment_not_found":
        raise HTTPException(status_code=404, detail="Comment not found")
    return comments_list or []



# ==================== Rejection Operations ====================

def reject_segment(
    db: Session,
    segment_id: str,
    reviewer_id: Optional[str] = None,
    rejection_reason: Optional[str] = None,
) -> OutlinerSegment:
    """Reject a checked segment and record the rejection event"""
    segment = outliner_repo.get_segment_plain(db, segment_id)
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    is_valid, error_msg = validate_segment_status_transition(segment.status, "rejected")
    if not is_valid:
        raise HTTPException(status_code=422, detail=error_msg)

    reason = none_check(rejection_reason, "Rejection comment is required")
    document = outliner_repo.fetch_document_by_id(db, segment.document_id)
    annotator_id = document.user_id if document else None

    outliner_repo.apply_rejection_to_segment(
        db, segment, annotator_id, reviewer_id, reason
    )
    return segment


def reject_segments_bulk(
    db: Session,
    segment_ids: List[str],
    reviewer_id: Optional[str] = None,
    rejection_reason: Optional[str] = None,
) -> List[OutlinerSegment]:
    """Reject multiple checked segments at once"""
    if not segment_ids:
        raise HTTPException(status_code=400, detail="segment_ids is required")
    
    reason = none_check(rejection_reason, "Rejection comment is required")
    try:
        return outliner_repo.reject_segments_bulk(db, segment_ids, reviewer_id, reason)
    except ValueError as e:
        if str(e) == "No segments found":
            raise HTTPException(status_code=404, detail=str(e)) from e
        raise


def get_segment_rejection_count(db: Session, segment_id: str) -> int:
    """Get the number of times a segment has been rejected"""
    return outliner_repo.get_segment_rejection_count(db, segment_id)


def get_annotator_performance_breakdown(
    db: Session,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    """
    Per-annotator metrics for documents in the date range (ignores user_id filter).
    Scoped by document.created_at. user_id None = unassigned documents.
    """
    return outliner_repo.get_annotator_performance_breakdown(
        db, start_date=start_date, end_date=end_date
    )


def get_dashboard_stats(
    db: Session,
    user_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> Dict[str, Any]:
    """Aggregate dashboard statistics, optionally scoped by user and date range."""
    return outliner_repo.get_dashboard_stats(
        db, user_id=user_id, start_date=start_date, end_date=end_date
    )


# ==================== BDRC Operations ====================

from bdrc.main import get_new_volume
from bdrc.volume import SegmentInput, VolumeInput, get_volume, update_volume, update_volume_status


def _bdrc_modified_by_from_document(db: Session, document: OutlinerDocument) -> Optional[str]:
    """BDRC OTAPI `modified_by`: prefer catalog user email, else user id (same pattern as frontend BDRC modals)."""
    return outliner_repo.bdrc_modified_by_from_document(db, document)


async def assign_volume(db: Session, user_id: str) -> OutlinerDocument:
    """Assign a volume to a document"""
    volume_data = await get_new_volume()
    if volume_data is None:
        raise HTTPException(status_code=400, detail="No volume found")
    chunks = volume_data["chunks"]
    text = ""
    for chunk in chunks:
        if chunk["text_bo"] is not None:
            text += chunk["text_bo"]
            
    # create a new document with the text
    if text is None or user_id is None:
        raise HTTPException(status_code=400, detail="Text or user_id is required")
    # check if the document already exists
    volume_id = volume_data["id"]
    
    if outliner_repo.fetch_document_by_filename(db, volume_id):
        raise HTTPException(
            status_code=400,
            detail=f"Document already exists for volume {volume_id}",
        )
    
    document = create_document(
            db=db,
            content=text,
            filename=volume_id,
            user_id=user_id
        )
   
    # update the volume status to "in_progress"
    await update_volume_status(volume_id, "in_progress")
    return document
    
    
    
    
    
# ==================== Approval Operations ====================

async def _push_document_segments_to_bdrc(
    document: OutlinerDocument,
    bdrc_status: str,
    modified_by: Optional[str] = None,
) -> Dict[str, Any]:
    """Sync document content and segments to BDRC OTAPI for the volume in document.filename."""
    if not document.filename or not str(document.filename).strip():
        raise HTTPException(
            status_code=400,
            detail="Document has no BDRC volume ID (filename); cannot sync to BDRC",
        )
    volume_id = str(document.filename).strip()
    volume = await get_volume(volume_id)
    rep_id = volume["rep_id"]
    vol_id = volume["vol_id"]
    vol_version = volume["vol_version"]
    base_text = document.content
    db_segments = document.segments
    segment_inputs = []
    for segment in db_segments:
        segment_start = int(segment.span_start)
        segment_end = int(segment.span_end)
        segment_title = segment.title or ""
        segment_author = segment.author
        mw_id = f'{volume["mw_id"]}_{segment.id}'
        wa_id = segment.title_bdrc_id or ''
        segment_inputs.append(SegmentInput(
            cstart=segment_start,
            cend=segment_end,
            title_bo=segment_title,
            author_name_bo=segment_author,
            mw_id=mw_id,
            wa_id=wa_id,
            part_type="text" if wa_id != '' else "editorial"
        ))
        print(rep_id, vol_id, vol_version, bdrc_status)
    return await update_volume(
        volume_id,
        VolumeInput(
            rep_id=rep_id,
            vol_id=vol_id,
            vol_version=vol_version,
            status=bdrc_status,
            base_text=base_text,
            segments=segment_inputs,
        ),
    )


async def submit_document_to_bdrc_in_review(db: Session, document_id: str) -> Dict[str, Any]:
    """Push current outline to BDRC with status in_review, then set document status to completed."""
    document = get_document(db, document_id, include_segments=True)
    modified_by = _bdrc_modified_by_from_document(db, document)
    bdrc_response = await _push_document_segments_to_bdrc(
        document, "in_review", modified_by=modified_by
    )
    update_document_status(db, document_id, "completed")
    return {"success":True}


def list_completed_document_ids_all_segments_checked(
    db: Session,
    only_document_ids: Optional[List[str]] = None,
) -> List[str]:
    """
    Documents with status `completed`, a non-empty BDRC volume id (`filename`),
    at least one segment, and every segment with status `checked`.

    If `only_document_ids` is not None, restrict to that set (after normalization in the caller).
    Empty `only_document_ids` yields no candidates.
    """
    return outliner_repo.list_completed_document_ids_all_segments_checked(
        db, only_document_ids=only_document_ids
    )


async def sync_outliner_document_to_bdrc_in_review(db: Session, document_id: str) -> Dict[str, Any]:
    """Push outline to BDRC with status in_review; leaves local outliner document status unchanged."""
    document = get_document(db, document_id, include_segments=True)
    modified_by = _bdrc_modified_by_from_document(db, document)
    return await _push_document_segments_to_bdrc(
        document, "in_review", modified_by=modified_by
    )


async def sync_completed_documents_to_bdrc_in_review(
    db: Session,
    only_document_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    For each completed outliner document whose segments are all `checked`, push volume to BDRC as `in_review`.
    Per-document failures are collected; successful syncs still apply.
    Progress is appended to backend/sync_status.txt.

    If `only_document_ids` is set, only those IDs are considered (must still satisfy completed / filename / all-checked).
    """
    sync_log = _bdrc_bulk_sync_file_logger()
    document_ids = list_completed_document_ids_all_segments_checked(db, only_document_ids=only_document_ids)
    total = len(document_ids)
    id_to_filename = outliner_repo.map_document_id_to_filename(db, document_ids)

    sync_log.info(
        "BDRC bulk sync start candidate_count=%s filter_document_ids=%s document_ids=%s",
        total,
        only_document_ids,
        document_ids,
    )

    succeeded: List[Dict[str, str]] = []
    failed: List[Dict[str, Any]] = []

    for i, document_id in enumerate(document_ids, start=1):
        filename = id_to_filename.get(document_id, "")
        sync_log.info(
            "BDRC bulk sync [%s/%s] pushing document_id=%s filename=%s",
            i,
            total,
            document_id,
            filename,
        )
        try:
            await sync_outliner_document_to_bdrc_in_review(db, document_id)
            succeeded.append({"document_id": document_id, "filename": filename})
            sync_log.info(
                "BDRC bulk sync [%s/%s] OK document_id=%s filename=%s",
                i,
                total,
                document_id,
                filename,
            )
        except HTTPException as e:
            detail = e.detail
            if not isinstance(detail, str):
                detail = str(detail)
            failed.append(
                {
                    "document_id": document_id,
                    "filename": filename,
                    "detail": detail,
                    "status_code": e.status_code,
                }
            )
            sync_log.warning(
                "BDRC bulk sync [%s/%s] FAILED document_id=%s filename=%s status_code=%s detail=%s",
                i,
                total,
                document_id,
                filename,
                e.status_code,
                detail,
            )
        except (TimeoutError, ConnectionError, RuntimeError) as e:
            failed.append({"document_id": document_id, "filename": filename, "detail": str(e)})
            sync_log.warning(
                "BDRC bulk sync [%s/%s] FAILED document_id=%s filename=%s error=%s",
                i,
                total,
                document_id,
                filename,
                e,
                exc_info=True,
            )
        except Exception as e:
            failed.append({"document_id": document_id, "filename": filename, "detail": str(e)})
            sync_log.exception(
                "BDRC bulk sync [%s/%s] FAILED document_id=%s filename=%s unexpected error",
                i,
                total,
                document_id,
                filename,
            )

    sync_log.info(
        "BDRC bulk sync finished candidate_count=%s succeeded=%s failed=%s",
        total,
        len(succeeded),
        len(failed),
    )
    return {
        "candidate_count": len(document_ids),
        "succeeded": succeeded,
        "failed": failed,
    }


async def approve_document(db: Session, document_id: str) -> OutlinerDocument:
    document = get_document(db, document_id , include_segments=True)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    non_approved = outliner_repo.count_non_approved_segments(db, document_id)
    if non_approved > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve document: {non_approved} segment(s) are not yet approved"
        )

    modified_by = _bdrc_modified_by_from_document(db, document)
    response_bdrc = await _push_document_segments_to_bdrc(
        document, "reviewed", modified_by=modified_by
    )
    update_document_status(db, document_id, "approved")
    return response_bdrc