"""Outliner document controller."""
import json
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException
from sqlalchemy.orm import Session
from types import SimpleNamespace

from core.redis import invalidate_document_content_cache, set_document_content_in_cache
from outliner.models.outliner import OutlinerDocument
from outliner.repository import outliner_repository as outliner_repo
from outliner.utils.outliner_utils import (
    get_document_with_cache,
    resolve_document_content,
)
from outliner.controller.segment import (
    _segment_orms_from_bulk_data,
    segment_orm_to_document_response_dict,
)



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

def get_assign_volume_eligibility(db: Session, user_id: str) -> Dict[str, bool]:
    """
    Whether the current user may request a new volume assignment: no active documents,
    every assigned document is skipped/completed/approved/deleted, no rejected segments
    on any of their documents, and completed/approved documents have only checked or
    approved segments.
    """
    allowed = outliner_repo.allow_user_to_assign_volume(db, user_id)
    return {"allowed": allowed}


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

