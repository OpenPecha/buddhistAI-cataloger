"""Review workflow routes under /api/v1/outliner/reviews."""

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from outliner.controller.outliner import reject_segments_bulk as reject_segments_bulk_ctrl
from outliner.routers import outliner as _legacy

router = APIRouter(prefix="/reviews", tags=["outliner-v1-reviews"])


@router.post("/rejections/batch", response_model=List[_legacy.SegmentResponse])
async def rejections_batch(
    request: _legacy.BulkRejectRequest,
    db: Session = Depends(get_db),
):
    segments = reject_segments_bulk_ctrl(
        db, request.segment_ids, request.reviewer_id, request.comment
    )
    return [
        _legacy._build_segment_response(
            seg,
            db,
            document_content=_legacy._document_plain_content(db, seg.document_id),
        )
        for seg in segments
    ]


@router.put("/rejections/batch", response_model=List[_legacy.SegmentResponse])
async def rejections_batch_put(
    request: _legacy.BulkRejectRequest,
    db: Session = Depends(get_db),
):
    """Compatibility: legacy used PUT for bulk reject."""
    segments = reject_segments_bulk_ctrl(
        db, request.segment_ids, request.reviewer_id, request.comment
    )
    return [
        _legacy._build_segment_response(
            seg,
            db,
            document_content=_legacy._document_plain_content(db, seg.document_id),
        )
        for seg in segments
    ]
