"""Top-level ``/outliner/ai-outline`` route."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ai_text_outline import extract_toc_indices

from core.database import get_db
from outliner.controller.outliner import (
    get_document as get_document_ctrl,
    replace_document_segments_and_ai_toc as replace_document_segments_and_ai_toc_ctrl,
)

from .helpers import spans_from_toc_indices
from .schemas import DocumentResponse, SegmentResponseDocument

router = APIRouter()


@router.post("/ai-outline", response_model=DocumentResponse)
async def ai_outline(
    document_id: str,
    db: Session = Depends(get_db),
):
    """Split document text into segments using TOC character indices from ai_text_outline."""
    document = get_document_ctrl(db, document_id, include_segments=False)
    result = extract_toc_indices(text=document.content)

    indices = result["breakpoints"]
    toc = result.get("toc")
    spans = spans_from_toc_indices(document.content, indices)
    segments_data = [
        {"segment_index": i, "span_start": start, "span_end": end}
        for i, (start, end) in enumerate(spans)
    ]
    document, segment_payload = replace_document_segments_and_ai_toc_ctrl(
        db, document_id, segments_data, toc
    )
    segments_resp = [
        SegmentResponseDocument(
            **{k: d[k] for k in SegmentResponseDocument.model_fields if k in d}
        )
        for d in segment_payload
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
        segments=segments_resp,
    )
