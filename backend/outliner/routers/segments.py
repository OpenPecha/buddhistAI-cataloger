"""Routes under ``/outliner/segments`` (top-level segment resource)."""

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from outliner.controller.outliner import (
    add_segment_comment as add_segment_comment_ctrl,
    delete_segment as delete_segment_ctrl,
    delete_segment_comment as delete_segment_comment_ctrl,
    get_segment as get_segment_ctrl,
    get_segment_comments as get_segment_comments_ctrl,
    merge_segments as merge_segments_ctrl,
    reject_segment as reject_segment_ctrl,
    reject_segments_bulk as reject_segments_bulk_ctrl,
    split_segment as split_segment_ctrl,
    update_segment as update_segment_ctrl,
    update_segment_comment as update_segment_comment_ctrl,
    update_segment_status as update_segment_status_ctrl,
    update_segments_bulk as update_segments_bulk_ctrl,
)
from outliner.deps import (
    apply_authenticated_segment_reviewer,
    apply_authenticated_segment_reviewer_bulk,
    require_outliner_access,
)
from user.models.user import User

from .helpers import build_segment_response, document_plain_content
from .schemas import (
    BulkRejectRequest,
    BulkSegmentUpdate,
    CommentAdd,
    CommentResponse,
    CommentUpdate,
    MergeSegmentsRequest,
    RejectSegmentRequest,
    SegmentResponse,
    SegmentStatusUpdate,
    SegmentUpdate,
    SplitSegmentRequest,
)

router = APIRouter()


@router.get("/segments/{segment_id}", response_model=SegmentResponse)
async def get_segment(
    segment_id: str,
    db: Session = Depends(get_db),
):
    """Get a single segment by ID"""
    segment = get_segment_ctrl(db, segment_id)
    return build_segment_response(
        segment,
        db,
        document_content=document_plain_content(db, segment.document_id),
    )


@router.put("/segments/{segment_id}", status_code=201)
async def update_segment(
    segment_id: str,
    segment_update: SegmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_outliner_access),
):
    """
    PERFORMANCE OPTIMIZED: Update a segment's content or annotations.

    Optimizations:
    1. Single SELECT to get segment (with old annotation status)
    2. Incremental document progress update (no COUNT queries)
    3. Avoid db.refresh() by using already-updated ORM object
    4. Single transaction commit

    Performance: Reduced from ~5 queries to 1-2 queries:
    - Before: 1 SELECT (segment) + 1 SELECT (document) + 2 COUNT(*) + 1 UPDATE (doc) + 1 UPDATE (segment) + 1 SELECT (refresh)
    - After: 1 SELECT (segment) + 1 UPDATE (segment) + 1 UPDATE (doc, if annotation changed)
    """
    patch = segment_update.model_dump(exclude_unset=True)
    apply_authenticated_segment_reviewer(patch, current_user)
    segment = update_segment_ctrl(db, segment_id, patch)
    return {"message": "segment updated", "id": segment.id}


@router.put("/segments/bulk", response_model=List[SegmentResponse])
async def update_segments_bulk(
    updates: BulkSegmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_outliner_access),
):
    """Update multiple segments at once"""
    segment_updates = [seg.model_dump(exclude_unset=True) for seg in updates.segments]
    apply_authenticated_segment_reviewer_bulk(segment_updates, current_user)
    updated_segments = update_segments_bulk_ctrl(db, segment_updates, updates.segment_ids)
    content = (
        document_plain_content(db, updated_segments[0].document_id)
        if updated_segments
        else ""
    )

    segment_responses = []
    for segment in updated_segments:
        segment_responses.append(build_segment_response(segment, db, document_content=content))
    return segment_responses


@router.post("/segments/{segment_id}/split")
async def split_segment(
    segment_id: str,
    split_request: SplitSegmentRequest,
    db: Session = Depends(get_db),
):
    """Split a segment at a given position"""
    split_segment_ctrl(
        db=db,
        segment_id=split_request.segment_id,
        split_position=split_request.split_position,
        document_id=split_request.document_id,
    )

    return {"message": "segment split", "id": segment_id}


@router.post("/segments/merge", response_model=SegmentResponse)
async def merge_segments(
    merge_request: MergeSegmentsRequest,
    db: Session = Depends(get_db),
):
    """Merge multiple segments into one"""
    first_segment = merge_segments_ctrl(db, merge_request.segment_ids)
    return build_segment_response(
        first_segment,
        db,
        document_content=document_plain_content(db, first_segment.document_id),
    )


@router.delete("/segments/{segment_id}", status_code=204)
async def delete_segment(
    segment_id: str,
    db: Session = Depends(get_db),
):
    """Delete a segment"""
    delete_segment_ctrl(db, segment_id)
    return None


@router.get("/segments/{segment_id}/comment", response_model=List[CommentResponse])
async def get_segment_comments(
    segment_id: str,
    db: Session = Depends(get_db),
):
    """Get all comments for a segment"""
    comments_list = get_segment_comments_ctrl(db, segment_id)
    return [CommentResponse(**c) for c in comments_list]


@router.post("/segments/{segment_id}/comment", response_model=List[CommentResponse])
async def add_segment_comment(
    segment_id: str,
    comment: CommentAdd,
    db: Session = Depends(get_db),
):
    """Add a comment to a segment"""
    comments_list = add_segment_comment_ctrl(
        db=db,
        segment_id=segment_id,
        content=comment.content,
        username=comment.username,
    )
    return [CommentResponse(**c) for c in comments_list]


@router.put("/segments/{segment_id}/comment/{comment_index}", response_model=List[CommentResponse])
async def update_segment_comment(
    segment_id: str,
    comment_index: int,
    comment_update: CommentUpdate,
    db: Session = Depends(get_db),
):
    """Update a specific comment by index"""
    comments_list = update_segment_comment_ctrl(
        db=db,
        segment_id=segment_id,
        comment_index=comment_index,
        content=comment_update.content,
    )
    return [CommentResponse(**c) for c in comments_list]


@router.delete("/segments/{segment_id}/comment/{comment_index}", response_model=List[CommentResponse])
async def delete_segment_comment(
    segment_id: str,
    comment_index: int,
    db: Session = Depends(get_db),
):
    """Delete a specific comment by index"""
    comments_list = delete_segment_comment_ctrl(
        db=db,
        segment_id=segment_id,
        comment_index=comment_index,
    )
    return [CommentResponse(**c) for c in comments_list]


@router.put("/segments/{segment_id}/status")
async def update_segment_status(
    segment_id: str,
    status_update: SegmentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_outliner_access),
):
    """Update segment status (checked/unchecked)"""
    return update_segment_status_ctrl(
        db=db,
        segment_id=segment_id,
        status=status_update.status,
        reviewer_id=current_user.id,
    )


@router.put("/segments/{segment_id}/reject", response_model=SegmentResponse)
async def reject_segment(
    segment_id: str,
    body: RejectSegmentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_outliner_access),
):
    """Reject a checked segment"""
    segment = reject_segment_ctrl(db, segment_id, current_user.id, body.comment)
    return build_segment_response(
        segment,
        db,
        document_content=document_plain_content(db, segment.document_id),
    )


@router.put("/segments/bulk-reject", response_model=List[SegmentResponse])
async def reject_segments_bulk(
    request: BulkRejectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_outliner_access),
):
    """Reject multiple checked segments at once"""
    segments = reject_segments_bulk_ctrl(
        db, request.segment_ids, current_user.id, request.comment
    )
    return [
        build_segment_response(
            seg,
            db,
            document_content=document_plain_content(db, seg.document_id),
        )
        for seg in segments
    ]
