"""Resource-first document routes under /api/v1/outliner/documents."""

from typing import Any, Dict, List, Optional

from ai_text_outline import extract_toc_indices
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import get_db
from outliner.deps import apply_authenticated_segment_reviewer_bulk, require_outliner_access
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
    ai_toc_db_value_to_api_items,
    list_documents as list_documents_ctrl,
    list_segments as list_segments_ctrl,
    replace_document_segments_and_ai_toc as replace_document_segments_and_ai_toc_ctrl,
    reset_segments as reset_segments_ctrl,
    submit_document_to_bdrc_in_review as submit_document_to_bdrc_in_review_ctrl,
    update_document_content as update_document_content_ctrl,
    update_document_status as update_document_status_ctrl,
)
from outliner.routers import outliner as _legacy
from user.models.user import User

router = APIRouter(prefix="/documents", tags=["outliner-v1-documents"])


class DocumentPatch(BaseModel):
    """Partial document update (replaces separate /content and /status routes)."""

    content: Optional[str] = None
    status: Optional[str] = None


@router.post("", response_model=_legacy.DocumentResponse, status_code=201)
async def create_document(
    document: _legacy.DocumentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_outliner_access),
):
    return create_document_ctrl(
        db=db,
        content=document.content,
        filename=document.filename,
        user_id=current_user.id,
    )


@router.get("", response_model=List[_legacy.DocumentListResponse])
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
    return list_documents_ctrl(
        db=db,
        user_id=user_id,
        status=status,
        skip=skip,
        limit=limit,
        include_deleted=include_deleted,
        title=title,
    )


@router.get("/{document_id}", response_model=_legacy.DocumentResponse)
async def get_document(
    document_id: str,
    include_segments: bool = True,
    db: Session = Depends(get_db),
):
    document = get_document_ctrl(db, document_id, include_segments)

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
            _legacy._segment_list_row_to_document_segment(s) for s in document.segment_list
        ]
        return _legacy.DocumentResponse(
            id=document.id,
            content=document.content,
            filename=document.filename,
            user_id=document.user_id,
            status=getattr(document, "status", None),
            created_at=document.created_at,
            updated_at=document.updated_at,
            is_supplied_title=getattr(document, "is_supplied_title", None),
            segments=segments_resp,
        )
    return _legacy.DocumentResponse(
        id=document.id,
        content=document.content,
        filename=document.filename,
        user_id=document.user_id,
        status=getattr(document, "status", None),
        created_at=document.created_at,
        updated_at=document.updated_at,
        is_supplied_title=getattr(document, "is_supplied_title", None),
        segments=[],
    )


@router.patch("/{document_id}")
async def patch_document(
    document_id: str,
    body: DocumentPatch,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_outliner_access),
):
    merged: Dict[str, Any] = {}
    if body.content is not None:
        merged.update(update_document_content_ctrl(db, document_id, body.content))
    if body.status is not None:
        merged.update(
            update_document_status_ctrl(
                db, document_id, body.status, user_id=current_user.id
            )
        )
    if not merged:
        raise HTTPException(status_code=400, detail="No fields to update")
    return merged


@router.delete("/{document_id}", status_code=204)
async def delete_document(document_id: str, db: Session = Depends(get_db)):
    delete_document_ctrl(db, document_id)
    return None


@router.get("/{document_id}/workspace", response_model=_legacy.DocumentWorkspaceResponse)
async def get_document_workspace(
    document_id: str,
    include_segments: bool = True,
    db: Session = Depends(get_db),
):
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
            _legacy._segment_list_row_to_document_segment(s) for s in document.segment_list
        ]
        return _legacy.DocumentWorkspaceResponse(
            id=document.id,
            content=document.content,
            filename=document.filename,
            status=getattr(document, "status", None),
            segments=segments_resp,
        )
    return _legacy.DocumentWorkspaceResponse(
        id=document.id,
        content=document.content,
        filename=document.filename,
        status=getattr(document, "status", None),
        segments=[],
    )


@router.get("/{document_id}/toc", response_model=_legacy.AiTocEntriesResponse)
async def get_document_toc(document_id: str, db: Session = Depends(get_db)):
    raw = get_document_ai_toc_entries_ctrl(db, document_id)
    items = ai_toc_db_value_to_api_items(raw)
    return _legacy.AiTocEntriesResponse(
        entries=[_legacy.AiTocEntryItem(**row) for row in items]
    )


@router.get("/{document_id}/stats")
async def get_document_stats(document_id: str, db: Session = Depends(get_db)):
    return get_document_progress_ctrl(db, document_id)


@router.post(
    "/{document_id}/segments",
    response_model=_legacy.SegmentResponse,
    status_code=201,
)
async def create_segment(
    document_id: str,
    segment: _legacy.SegmentCreate,
    db: Session = Depends(get_db),
):
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
    return _legacy._build_segment_response(
        db_segment,
        db,
        document_content=_legacy._document_plain_content(db, document_id),
    )


@router.post(
    "/{document_id}/segments/bulk",
    response_model=List[_legacy.SegmentResponse],
    status_code=201,
)
async def create_segments_bulk(
    document_id: str,
    segments: List[_legacy.SegmentCreate],
    db: Session = Depends(get_db),
):
    segments_data = [seg.model_dump() for seg in segments]
    db_segments = create_segments_bulk_ctrl(db, document_id, segments_data)
    content = _legacy._document_plain_content(db, document_id)
    return [
        _legacy._build_segment_response(segment, db, document_content=content)
        for segment in db_segments
    ]


@router.get("/{document_id}/segments", response_model=List[_legacy.SegmentResponse])
async def list_segments(document_id: str, db: Session = Depends(get_db)):
    content = _legacy._document_plain_content(db, document_id)
    segments = list_segments_ctrl(db, document_id)
    return [
        _legacy._build_segment_response(segment, db, document_content=content)
        for segment in segments
    ]


@router.delete("/{document_id}/segments", status_code=204)
async def delete_all_segments(document_id: str, db: Session = Depends(get_db)):
    reset_segments_ctrl(db, document_id)
    return None


@router.post(
    "/{document_id}/segments/batch",
    response_model=List[_legacy.SegmentResponse],
)
async def segments_batch(
    document_id: str,
    operations: _legacy.BulkSegmentOperationsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_outliner_access),
):
    create_data = (
        [seg.model_dump() for seg in operations.create] if operations.create else None
    )
    apply_authenticated_segment_reviewer_bulk(operations.update, current_user)
    result_segments = bulk_segment_operations_ctrl(
        db=db,
        document_id=document_id,
        create=create_data,
        update=operations.update,
        delete=operations.delete,
    )
    content = _legacy._document_plain_content(db, document_id)
    return [
        _legacy._build_segment_response(seg, db, document_content=content)
        for seg in result_segments
    ]


@router.post("/{document_id}/reviews/approve")
async def approve_document(document_id: str, db: Session = Depends(get_db)):
    return await approve_document_ctrl(db, document_id)


@router.post("/{document_id}/ai/outline", response_model=_legacy.DocumentResponse)
async def ai_outline(document_id: str, db: Session = Depends(get_db)):
    document = get_document_ctrl(db, document_id, include_segments=False)
    result = extract_toc_indices(text=document.content)

    indices = result["breakpoints"]
    toc = result.get("toc")
    spans = _legacy._spans_from_toc_indices(document.content, indices)
    segments_data = [
        {"segment_index": i, "span_start": start, "span_end": end}
        for i, (start, end) in enumerate(spans)
    ]
    document, segment_payload = replace_document_segments_and_ai_toc_ctrl(
        db, document_id, segments_data, toc
    )
    segments_resp = [
        _legacy.SegmentResponseDocument(
            **{k: d[k] for k in _legacy.SegmentResponseDocument.model_fields if k in d}
        )
        for d in segment_payload
    ]
    return _legacy.DocumentResponse(
        id=document.id,
        content=document.content,
        filename=document.filename,
        user_id=document.user_id,
        status=getattr(document, "status", None),
        created_at=document.created_at,
        updated_at=document.updated_at,
        is_supplied_title=getattr(document, "is_supplied_title", None),
        segments=segments_resp,
    )


@router.post("/{document_id}/submissions/bdrc")
async def submit_bdrc(document_id: str, db: Session = Depends(get_db)):
    return await submit_document_to_bdrc_in_review_ctrl(db, document_id)
