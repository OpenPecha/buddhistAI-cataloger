"""Persist segment JSON comment threads on outliner_segment.comment."""
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from outliner.repository.segment_queries import get_segment_plain
from outliner.utils.outliner_utils import get_comments_list


def get_segment_comments_list(db: Session, segment_id: str) -> Optional[List[Dict[str, Any]]]:
    segment = get_segment_plain(db, segment_id)
    if not segment:
        return None
    return get_comments_list(segment)


def add_segment_comment_persist(
    db: Session, segment_id: str, content: str, username: str
) -> Optional[List[Dict[str, Any]]]:
    segment = get_segment_plain(db, segment_id)
    if not segment:
        return None
    existing_comments = get_comments_list(segment)
    new_comment = {
        "content": content,
        "username": username,
        "timestamp": datetime.utcnow().isoformat(),
    }
    existing_comments.append(new_comment)
    segment.comment = existing_comments
    flag_modified(segment, "comment")
    segment.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(segment)
    return existing_comments


def update_segment_comment_persist(
    db: Session, segment_id: str, comment_index: int, content: str
) -> Tuple[Optional[List[Dict[str, Any]]], Optional[str]]:
    segment = get_segment_plain(db, segment_id)
    if not segment:
        return None, "segment_not_found"
    comments_list = get_comments_list(segment)
    if comment_index < 0 or comment_index >= len(comments_list):
        return None, "comment_not_found"
    comments_list[comment_index]["content"] = content
    comments_list[comment_index]["timestamp"] = datetime.utcnow().isoformat()
    segment.comment = comments_list
    flag_modified(segment, "comment")
    segment.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(segment)
    return comments_list, None


def delete_segment_comment_persist(
    db: Session, segment_id: str, comment_index: int
) -> Tuple[Optional[List[Dict[str, Any]]], Optional[str]]:
    segment = get_segment_plain(db, segment_id)
    if not segment:
        return None, "segment_not_found"
    comments_list = get_comments_list(segment)
    if comment_index < 0 or comment_index >= len(comments_list):
        return None, "comment_not_found"
    comments_list.pop(comment_index)
    if len(comments_list) == 0:
        segment.comment = None
    else:
        segment.comment = comments_list
        flag_modified(segment, "comment")
    segment.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(segment)
    return comments_list, None
