"""Bulk segment updates and transactional bulk create/update/delete."""
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from outliner.controller.segment_common import _normalize_reviewer_title_value
from outliner.models.outliner import OutlinerSegment, SegmentLabels
from outliner.repository import outliner_repository as outliner_repo
from outliner.utils.segment_title_author_auto import apply_auto_title_to_segment
from outliner.utils.outliner_utils import (
    get_document_with_cache,
    validate_segment_status_transition,
)


def update_segments_bulk(
    db: Session,
    segment_updates: List[Dict[str, Any]],
    segment_ids: List[str]
) -> List[OutlinerSegment]:
    """Update multiple segments at once"""
    if len(segment_updates) != len(segment_ids):
        raise HTTPException(
            status_code=400,
            detail="Number of segments must match number of segment_ids"
        )

    updated_segments = []

    for segment_id, segment_update in zip(segment_ids, segment_updates):
        segment = outliner_repo.get_segment_plain(db, segment_id)
        if not segment:
            continue

        old_status = segment.status
        old_label = segment.label

        if 'title' in segment_update:
            segment.title = segment_update['title']
        if 'author' in segment_update:
            segment.author = segment_update['author']
        if 'title_bdrc_id' in segment_update:
            segment.title_bdrc_id = segment_update['title_bdrc_id']
        if 'author_bdrc_id' in segment_update:
            segment.author_bdrc_id = segment_update['author_bdrc_id']
        if 'parent_segment_id' in segment_update:
            segment.parent_segment_id = segment_update['parent_segment_id']
        if 'is_attached' in segment_update:
            segment.is_attached = segment_update['is_attached']
        if 'status' in segment_update:
            new_st = segment_update['status']
            prev_st = segment.status
            is_valid, _ = validate_segment_status_transition(segment.status, new_st)
            if not is_valid:
                continue
            outliner_repo.apply_segment_review_metadata(
                segment,
                prev_st,
                new_st,
                segment_update.get('reviewer_id'),
            )
            outliner_repo.apply_segment_review_title_author_tracking(
                segment, prev_st, new_st
            )
            segment.status = new_st
        if 'label' in segment_update:
            lbl = segment_update['label']
            if lbl is not None:
                try:
                    segment.label = SegmentLabels[lbl]
                except KeyError:
                    pass
            else:
                segment.label = None
        if 'is_supplied_title' in segment_update:
            segment.is_supplied_title = segment_update['is_supplied_title']
        for span_key in (
            'title_span_start', 'title_span_end', 'updated_title',
            'author_span_start', 'author_span_end', 'updated_author',
        ):
            if span_key in segment_update:
                setattr(segment, span_key, segment_update[span_key])
        if 'reviewer_title' in segment_update:
            segment.reviewer_title = _normalize_reviewer_title_value(
                segment_update['reviewer_title']
            )
        if 'reviewer_author' in segment_update:
            segment.reviewer_author = segment_update['reviewer_author']

        label_became_text = (
            'label' in segment_update
            and segment.label == SegmentLabels.TEXT
            and old_label != SegmentLabels.TEXT
        )
        user_nonempty_title = (
            'title' in segment_update
            and segment_update.get('title') is not None
            and str(segment_update.get('title')).strip() != ''
        )
        if label_became_text and not user_nonempty_title:
            apply_auto_title_to_segment(db, segment)

        segment.update_annotation_status()
        segment.updated_at = datetime.utcnow()
        if old_status == "rejected" and segment.status != "rejected":
            outliner_repo.handle_segment_leaving_rejected_status(
                db,
                segment.id,
                reviewer_undo=bool(segment_update.get("reviewer_id")),
            )
        updated_segments.append(segment)

    outliner_repo.commit_and_refresh_segments(db, updated_segments)

    return updated_segments


def bulk_segment_operations(
    db: Session,
    document_id: str,
    create: Optional[List[Dict[str, Any]]] = None,
    update: Optional[List[Dict[str, Any]]] = None,
    delete: Optional[List[str]] = None
) -> List[OutlinerSegment]:
    """
    Perform bulk operations on segments: create, update, and delete in a single transaction.
    """
    document = get_document_with_cache(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        return outliner_repo.run_bulk_segment_ops(
            db, document, create=create, update=update, delete=delete
        )
    except ValueError as e:
        msg = str(e)
        if "Invalid span addresses" in msg:
            raise HTTPException(status_code=400, detail=msg) from e
        if "not found" in msg.lower():
            raise HTTPException(status_code=404, detail=msg) from e
        raise HTTPException(status_code=422, detail=msg) from e
