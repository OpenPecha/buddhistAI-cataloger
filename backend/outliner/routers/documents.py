"""Routes under ``/outliner/documents`` (including nested ``.../segments``)."""

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from core.database import get_db
from outliner.controller.outliner import (
    approve_document as approve_document_ctrl,
    bulk_segment_operations as bulk_segment_operations_ctrl,
    create_document as create_document_ctrl,
    create_segment as create_segment_ctrl,
    create_segments_bulk as create_segments_bulk_ctrl,
    delete_document as delete_document_ctrl,
    get_document as get_document_ctrl,
    get_document_ai_toc_entries as get_document_ai_toc_entries_ctrl,
    get_document_for_workspace as get_document_for_workspace_ctrl,
    get_document_progress as get_document_progress_ctrl,
    list_documents as list_documents_ctrl,
    list_segments as list_segments_ctrl,
    reset_segments as reset_segments_ctrl,
    submit_document_to_bdrc_in_review as submit_document_to_bdrc_in_review_ctrl,
    update_document_content as update_document_content_ctrl,
    update_document_status as update_document_status_ctrl,
    ai_toc_db_value_to_api_items,
)
from outliner.deps import (
    apply_authenticated_segment_reviewer_bulk,
    require_outliner_access,
)
from user.models.user import User

from .helpers import (
    build_segment_response,
    document_plain_content,
    segment_list_row_to_document_segment,
)
from .schemas import (
    AiTocEntriesResponse,
    AiTocEntryItem,
    BulkSegmentOperationsRequest,
    DocumentCreate,
    DocumentListResponse,
    DocumentResponse,
    DocumentStatusUpdate,
    DocumentWorkspaceResponse,
    SegmentCreate,
    SegmentResponse,
)

router = APIRouter()


@router.post("/documents", response_model=DocumentResponse, status_code=201)
async def create_document(
    document: DocumentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_outliner_access),
):
    """Create a new outliner document with full text content"""
    db_document = create_document_ctrl(
        db=db,
        content=document.content,
        filename=document.filename,
        user_id=current_user.id,
    )
    return db_document


@router.get("/documents", response_model=List[DocumentListResponse])
async def list_documents(
    user_id: Optional[str] = None,
    status: Optional[str] = None,
    title: Optional[str] = Query(
        None,
        description="Case-insensitive partial match on document title (filename)",
    ),
    skip: int = 0,
    limit: int = 100,
    include_deleted: bool = False,
    db: Session = Depends(get_db),
):
    """
    List all outliner documents, optionally filtered by user, status, title search, and deletion status.

    Each item may include `rejected_segment`: the most recent segment rejection in that document
    (message, document_id, segment_id, reviewer_user) for annotator-facing notices.

    Args:
        user_id: Filter documents by user ID (annotator)
        status: Filter by document status (active, completed, approved)
        title: Search string matched against document filename (display title in list views)
        skip: Number of documents to skip (pagination)
        limit: Maximum number of documents to return
        include_deleted: If False (default), exclude deleted documents. If True, include all documents.
    """
    result = list_documents_ctrl(
        db=db,
        user_id=user_id,
        status=status,
        skip=skip,
        limit=limit,
        include_deleted=include_deleted,
        title=title,
    )
    return result


@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    include_segments: bool = True,
    db: Session = Depends(get_db),
):
    """Get a document by ID with all its segments (full metadata)."""
    document = get_document_ctrl(db, document_id, include_segments)

    # If segments are requested but none exist, create a single segment covering the entire document
    if include_segments:
        segments_exist = (
            hasattr(document, "segment_list")
            and document.segment_list
            and len(document.segment_list) > 0
        )
        if not segments_exist:
            text_length = len(document.content)
            create_segment_ctrl(
                db=db,
                document_id=document_id,
                segment_index=0,
                span_start=0,
                span_end=text_length,
                text=None,
            )
            document = get_document_ctrl(db, document_id, include_segments)

    if include_segments and hasattr(document, "segment_list") and document.segment_list:
        segments_resp = [
            segment_list_row_to_document_segment(s) for s in document.segment_list
        ]
        return DocumentResponse(
            id=document.id,
            content=document.content,
            filename=document.filename,
            user_id=document.user_id,
            status=getattr(document, "status", None),
            created_at=document.created_at,
            updated_at=document.updated_at,
            is_supplied_title=getattr(document, "is_supplied_title", None),
            submit_count=getattr(document, "submit_count", None),
            segments=segments_resp,
        )
    return DocumentResponse(
        id=document.id,
        content=document.content,
        filename=document.filename,
        user_id=document.user_id,
        status=getattr(document, "status", None),
        created_at=document.created_at,
        updated_at=document.updated_at,
        is_supplied_title=getattr(document, "is_supplied_title", None),
        submit_count=getattr(document, "submit_count", None),
        segments=[],
    )


@router.get(
    "/documents/{document_id}/workspace",
    response_model=DocumentWorkspaceResponse,
)
async def get_document_workspace(
    document_id: str,
    include_segments: bool = True,
    db: Session = Depends(get_db),
):
    """
    Annotator workspace: id, filename, status, full text, and segments only.
    Content is served from Redis when cached; otherwise one read of the content column.
    Segments are read only from outliner_segments for this document.
    """
    document = get_document_for_workspace_ctrl(db, document_id, include_segments)

    if include_segments:
        segments_exist = (
            hasattr(document, "segment_list")
            and document.segment_list
            and len(document.segment_list) > 0
        )
        if not segments_exist:
            text_length = len(document.content)
            create_segment_ctrl(
                db=db,
                document_id=document_id,
                segment_index=0,
                span_start=0,
                span_end=text_length,
                text=None,
            )
            document = get_document_for_workspace_ctrl(db, document_id, include_segments)

    if include_segments and hasattr(document, "segment_list") and document.segment_list:
        segments_resp = [
            segment_list_row_to_document_segment(s) for s in document.segment_list
        ]
        return DocumentWorkspaceResponse(
            id=document.id,
            content=document.content,
            filename=document.filename,
            status=getattr(document, "status", None),
            segments=segments_resp,
        )
    return DocumentWorkspaceResponse(
        id=document.id,
        content=document.content,
        filename=document.filename,
        status=getattr(document, "status", None),
        segments=[],
    )


@router.get(
    "/documents/{document_id}/ai-toc-entries",
    response_model=AiTocEntriesResponse,
)
async def get_document_ai_toc_entries(
    document_id: str,
    db: Session = Depends(get_db),
):
    """Return AI / stored TOC as page numbers and titles (not included on the main document payload)."""
    raw = get_document_ai_toc_entries_ctrl(db, document_id)
    items = ai_toc_db_value_to_api_items(raw)
    return AiTocEntriesResponse(entries=[AiTocEntryItem(**row) for row in items])


@router.put("/documents/{document_id}/content")
async def update_document_content(
    document_id: str,
    content: str,
    db: Session = Depends(get_db),
):
    """Update the full text content of a document"""
    return update_document_content_ctrl(db, document_id, content)


@router.delete("/documents/{document_id}", status_code=204)
async def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
):
    """Delete a document and all its segments"""
    delete_document_ctrl(db, document_id)
    return None


@router.post("/documents/{document_id}/segments", response_model=SegmentResponse, status_code=201)
async def create_segment(
    document_id: str,
    segment: SegmentCreate,
    db: Session = Depends(get_db),
):
    """Create a new segment in a document"""
    db_segment = create_segment_ctrl(
        db=db,
        document_id=document_id,
        segment_index=segment.segment_index,
        span_start=segment.span_start,
        span_end=segment.span_end,
        text=segment.text,
        title=segment.title,
        author=segment.author,
        title_bdrc_id=segment.title_bdrc_id,
        author_bdrc_id=segment.author_bdrc_id,
        parent_segment_id=segment.parent_segment_id,
    )
    return build_segment_response(
        db_segment,
        db,
        document_content=document_plain_content(db, document_id),
    )


@router.post("/documents/{document_id}/segments/bulk", response_model=List[SegmentResponse], status_code=201)
async def create_segments_bulk(
    document_id: str,
    segments: List[SegmentCreate],
    db: Session = Depends(get_db),
):
    """Create multiple segments at once"""
    segments_data = [seg.dict() for seg in segments]
    db_segments = create_segments_bulk_ctrl(db, document_id, segments_data)
    content = document_plain_content(db, document_id)

    segment_responses = []
    for segment in db_segments:
        segment_responses.append(build_segment_response(segment, db, document_content=content))
    return segment_responses


@router.get("/documents/{document_id}/segments", response_model=List[SegmentResponse])
async def list_segments(
    document_id: str,
    db: Session = Depends(get_db),
):
    """Get all segments for a document"""
    content = document_plain_content(db, document_id)
    segments = list_segments_ctrl(db, document_id)
    segment_responses = []
    for segment in segments:
        segment_responses.append(build_segment_response(segment, db, document_content=content))
    return segment_responses


@router.post("/documents/{document_id}/segments/bulk-operations", response_model=List[SegmentResponse])
async def bulk_segment_operations(
    document_id: str,
    operations: BulkSegmentOperationsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_outliner_access),
):
    """
    Perform bulk operations on segments: create, update, and delete in a single transaction.
    This is optimized for performance by batching all operations together.
    """
    create_data = [seg.dict() for seg in operations.create] if operations.create else None
    apply_authenticated_segment_reviewer_bulk(operations.update, current_user)
    result_segments = bulk_segment_operations_ctrl(
        db=db,
        document_id=document_id,
        create=create_data,
        update=operations.update,
        delete=operations.delete,
    )
    content = document_plain_content(db, document_id)

    segment_responses = []
    for seg in result_segments:
        segment_responses.append(build_segment_response(seg, db, document_content=content))
    return segment_responses


@router.delete("/documents/{document_id}/segments/reset", status_code=204)
async def reset_segments(
    document_id: str,
    db: Session = Depends(get_db),
):
    """Delete all segments for a document"""
    reset_segments_ctrl(db, document_id)
    return None


@router.put("/documents/{document_id}/status")
async def update_document_status(
    document_id: str,
    status_update: DocumentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_outliner_access),
):
    """
    Update document status.

    When restoring a deleted document (changing status from 'deleted' to 'active'),
    ownership is verified against the authenticated user.
    """
    return update_document_status_ctrl(
        db=db,
        document_id=document_id,
        status=status_update.status,
        user_id=current_user.id,
    )


@router.get("/documents/{document_id}/progress")
async def get_document_progress(
    document_id: str,
    db: Session = Depends(get_db),
):
    """Get progress statistics for a document"""
    return get_document_progress_ctrl(db, document_id)


@router.post("/documents/{document_id}/submit-bdrc-in-review")
async def submit_document_to_bdrc_in_review(
    document_id: str,
    db: Session = Depends(get_db),
):
    """Push outline to BDRC with status in_review and set document status to completed."""
    return await submit_document_to_bdrc_in_review_ctrl(db, document_id)


@router.post("/documents/{document_id}/approve")
async def approve_document(
    document_id: str,
    db: Session = Depends(get_db),
):
    """Approve all segments for a document"""
    return await approve_document_ctrl(db, document_id)
