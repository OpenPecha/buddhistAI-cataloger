"""Segment comments under /api/v1/outliner/segments/{segment_id}/comments."""

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from outliner.controller.outliner import (
    add_segment_comment as add_segment_comment_ctrl,
    delete_segment_comment as delete_segment_comment_ctrl,
    get_segment_comments as get_segment_comments_ctrl,
    update_segment_comment as update_segment_comment_ctrl,
)
from outliner.routers import outliner as _legacy

router = APIRouter(
    prefix="/segments/{segment_id}/comments",
    tags=["outliner-v1-comments"],
)


@router.get("", response_model=List[_legacy.CommentResponse])
async def get_comments(segment_id: str, db: Session = Depends(get_db)):
    comments_list = get_segment_comments_ctrl(db, segment_id)
    return [_legacy.CommentResponse(**c) for c in comments_list]


@router.post("", response_model=List[_legacy.CommentResponse])
async def add_comment(
    segment_id: str,
    comment: _legacy.CommentAdd,
    db: Session = Depends(get_db),
):
    comments_list = add_segment_comment_ctrl(
        db=db,
        segment_id=segment_id,
        content=comment.content,
        username=comment.username,
    )
    return [_legacy.CommentResponse(**c) for c in comments_list]


@router.patch("/{comment_id}", response_model=List[_legacy.CommentResponse])
async def patch_comment(
    segment_id: str,
    comment_id: int,
    comment_update: _legacy.CommentUpdate,
    db: Session = Depends(get_db),
):
    """comment_id is the 0-based index in the segment's comment list (stable until reorder)."""
    comments_list = update_segment_comment_ctrl(
        db=db,
        segment_id=segment_id,
        comment_index=comment_id,
        content=comment_update.content,
    )
    return [_legacy.CommentResponse(**c) for c in comments_list]


@router.put("/{comment_id}", response_model=List[_legacy.CommentResponse])
async def put_comment(
    segment_id: str,
    comment_id: int,
    comment_update: _legacy.CommentUpdate,
    db: Session = Depends(get_db),
):
    comments_list = update_segment_comment_ctrl(
        db=db,
        segment_id=segment_id,
        comment_index=comment_id,
        content=comment_update.content,
    )
    return [_legacy.CommentResponse(**c) for c in comments_list]


@router.delete("/{comment_id}", response_model=List[_legacy.CommentResponse])
async def delete_comment(
    segment_id: str,
    comment_id: int,
    db: Session = Depends(get_db),
):
    comments_list = delete_segment_comment_ctrl(
        db=db,
        segment_id=segment_id,
        comment_index=comment_id,
    )
    return [_legacy.CommentResponse(**c) for c in comments_list]
