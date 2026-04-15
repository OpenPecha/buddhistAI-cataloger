"""Segment comment CRUD."""
from typing import Any, Dict, List

from fastapi import HTTPException
from sqlalchemy.orm import Session

from outliner.repository import outliner_repository as outliner_repo


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
    username: str,
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
    content: str,
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
    comment_index: int,
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
