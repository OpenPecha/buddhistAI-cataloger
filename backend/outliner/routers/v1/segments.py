"""Top-level segment routes under /api/v1/outliner/segments."""

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from core.database import get_db
from outliner.controller.outliner import (
    delete_segment as delete_segment_ctrl,
    get_segment as get_segment_ctrl,
    merge_segments as merge_segments_ctrl,
    reject_segment as reject_segment_ctrl,
    split_segment as split_segment_ctrl,
    update_segment as update_segment_ctrl,
    update_segment_status as update_segment_status_ctrl,
    update_segments_bulk as update_segments_bulk_ctrl,
)
from outliner.routers import outliner as _legacy

router = APIRouter(prefix="/segments", tags=["outliner-v1-segments"])


class RejectSegmentV1Body(BaseModel):
    comment: str = Field(..., min_length=1)
    reviewer_id: Optional[str] = None


class SegmentStatusPatch(BaseModel):
    status: str
    reviewer_id: Optional[str] = None


@router.post("/merge", response_model=_legacy.SegmentResponse)
async def merge_segments(
    merge_request: _legacy.MergeSegmentsRequest,
    db: Session = Depends(get_db),
):
    first_segment = merge_segments_ctrl(db, merge_request.segment_ids)
    return _legacy._build_segment_response(
        first_segment,
        db,
        document_content=_legacy._document_plain_content(db, first_segment.document_id),
    )


@router.put("/bulk", response_model=List[_legacy.SegmentResponse])
async def update_segments_bulk(
    updates: _legacy.BulkSegmentUpdate,
    db: Session = Depends(get_db),
):
    segment_updates = [seg.model_dump(exclude_unset=True) for seg in updates.segments]
    updated_segments = update_segments_bulk_ctrl(db, segment_updates, updates.segment_ids)
    content = (
        _legacy._document_plain_content(db, updated_segments[0].document_id)
        if updated_segments
        else ""
    )
    return [
        _legacy._build_segment_response(segment, db, document_content=content)
        for segment in updated_segments
    ]


@router.get("/{segment_id}", response_model=_legacy.SegmentResponse)
async def get_segment(segment_id: str, db: Session = Depends(get_db)):
    segment = get_segment_ctrl(db, segment_id)
    return _legacy._build_segment_response(
        segment,
        db,
        document_content=_legacy._document_plain_content(db, segment.document_id),
    )


@router.patch("/{segment_id}", status_code=200)
async def patch_segment(
    segment_id: str,
    segment_update: _legacy.SegmentUpdate,
    db: Session = Depends(get_db),
):
    patch = segment_update.model_dump(exclude_unset=True)
    segment = update_segment_ctrl(db, segment_id, patch)
    return {"message": "segment updated", "id": segment.id}


@router.put("/{segment_id}", status_code=201)
async def put_segment(
    segment_id: str,
    segment_update: _legacy.SegmentUpdate,
    db: Session = Depends(get_db),
):
    """Compatibility: same behavior as PATCH (legacy clients used PUT)."""
    patch = segment_update.model_dump(exclude_unset=True)
    segment = update_segment_ctrl(db, segment_id, patch)
    return {"message": "segment updated", "id": segment.id}


@router.post("/{segment_id}/split")
async def split_segment(
    segment_id: str,
    split_request: _legacy.SplitSegmentRequest,
    db: Session = Depends(get_db),
):
    split_segment_ctrl(
        db=db,
        segment_id=split_request.segment_id,
        split_position=split_request.split_position,
        document_id=split_request.document_id,
    )
    return {"message": "segment split", "id": segment_id}


@router.delete("/{segment_id}", status_code=204)
async def delete_segment(segment_id: str, db: Session = Depends(get_db)):
    delete_segment_ctrl(db, segment_id)
    return None


@router.patch("/{segment_id}/status")
async def patch_segment_status(
    segment_id: str,
    status_update: SegmentStatusPatch,
    db: Session = Depends(get_db),
):
    return update_segment_status_ctrl(
        db=db,
        segment_id=segment_id,
        status=status_update.status,
        reviewer_id=status_update.reviewer_id,
    )


@router.put("/{segment_id}/status")
async def put_segment_status(
    segment_id: str,
    status_update: _legacy.SegmentStatusUpdate,
    db: Session = Depends(get_db),
):
    """Compatibility: legacy PUT /status."""
    return update_segment_status_ctrl(
        db=db,
        segment_id=segment_id,
        status=status_update.status,
        reviewer_id=status_update.reviewer_id,
    )


@router.post("/{segment_id}/reviews/reject", response_model=_legacy.SegmentResponse)
async def reject_segment(
    segment_id: str,
    body: RejectSegmentV1Body,
    db: Session = Depends(get_db),
):
    segment = reject_segment_ctrl(db, segment_id, body.reviewer_id, body.comment)
    return _legacy._build_segment_response(
        segment,
        db,
        document_content=_legacy._document_plain_content(db, segment.document_id),
    )


@router.put("/{segment_id}/reject", response_model=_legacy.SegmentResponse)
async def reject_segment_legacy_shape(
    segment_id: str,
    body: _legacy.RejectSegmentRequest,
    reviewer_id: Optional[str] = Query(
        None, description="Optional reviewer user id (prefer JSON body on POST .../reviews/reject)"
    ),
    db: Session = Depends(get_db),
):
    """Same as legacy PUT /outliner/segments/{id}/reject (query reviewer_id)."""
    segment = reject_segment_ctrl(db, segment_id, reviewer_id, body.comment)
    return _legacy._build_segment_response(
        segment,
        db,
        document_content=_legacy._document_plain_content(db, segment.document_id),
    )
