"""Top-level ``/outliner/ai-outline`` route."""

from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from outline_detection.api import detect_breakpoints

from core.database import get_db
from outliner.controller.outliner import (
    get_document,
    replace_segments_and_toc,
    save_ai_outline_run,
)
from outliner.deps import require_outliner_access
from user.models.user import User

from .helpers import spans_from_toc_indices
from .schemas import AiOutlineResponse

router = APIRouter()

OutlineDetector = Literal["rule", "mmbert"]


@router.post("/ai-outline", response_model=AiOutlineResponse)
async def ai_outline(
    document_id: str,
    detector: OutlineDetector = Query(
        "rule",
        description='Boundary detector: "rule" (pattern-based) or "mmbert" (neural).',
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_outliner_access)
):
    """Split document text into segments using boundary character indices from outline_detection."""
    document = get_document(db, document_id, include_segments=False)
    result = detect_breakpoints(
        text=document.content,
        detector=detector,
        profile="balanced",
        
    )

    indices = result["breakpoints"]
    toc = None
    spans = spans_from_toc_indices(document.content, indices)
    segments_data = [
        {"segment_index": i, "span_start": start, "span_end": end}
        for i, (start, end) in enumerate(spans)
    ]
    _, segment_payload = replace_segments_and_toc(
        db, document_id, segments_data, toc
    )
    save_ai_outline_run(
        db, document_id, segments_data, current_user.id, detector=detector
    )
    return AiOutlineResponse(segment_count=len(segment_payload))
