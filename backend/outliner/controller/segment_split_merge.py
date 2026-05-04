"""Split and merge segment controller logic."""
import uuid
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from outliner.models.outliner import OutlinerSegment, SegmentLabels
from outliner.repository import outliner_repository as outliner_repo
from outliner.utils.segment_title_author_auto import apply_split_auto_title_author_parallel
from outliner.utils.outliner_utils import (
    get_document_with_cache,
    infer_segment_label_for_new_segment,
    segment_body_from_document,
)


def split_segment(
    db: Session,
    segment_id: str,
    split_position: int,
    document_id: Optional[str] = None
) -> List[OutlinerSegment]:
    """Split a segment at a given position"""
    segment = outliner_repo.get_segment_by_pk(db, segment_id)

    if not segment:
        if not document_id:
            raise HTTPException(status_code=404, detail="Segment not found")

        document = get_document_with_cache(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        if outliner_repo.document_has_any_segment(db, document_id):
            raise HTTPException(status_code=404, detail="Segment not found")

        if not document.content or len(document.content.strip()) == 0:
            raise HTTPException(status_code=400, detail="Document has no content to split")

        segment = OutlinerSegment(
            id=str(uuid.uuid4()),
            document_id=document_id,
            text="",
            segment_index=0,
            span_start=0,
            span_end=len(document.content),
            title=None,
            author=None,
            parent_segment_id=None,
            label=SegmentLabels.FRONT_MATTER,
            status='unchecked',
        )
        segment.update_annotation_status()
        outliner_repo.add_segment_flush(db, segment)

    doc_for_body = get_document_with_cache(db, segment.document_id)
    if not doc_for_body:
        raise HTTPException(status_code=404, detail="Document not found")
    content = doc_for_body.content or ""
    body = segment_body_from_document(content, segment.span_start, segment.span_end)

    if split_position <= 0 or split_position >= len(body):
        raise HTTPException(status_code=400, detail="Invalid split position")

    old_span_start = segment.span_start
    old_span_end = segment.span_end
    new_first_span_end = old_span_start + split_position

    if new_first_span_end < old_span_start or new_first_span_end > old_span_end:
        raise HTTPException(status_code=400, detail="Invalid split position for segment span")

    text_before = body[:split_position]
    text_after = body[split_position:]

    segment.text = ""
    segment.span_end = new_first_span_end
    upper_label = infer_segment_label_for_new_segment(segment.title, text_before)
    lower_label = infer_segment_label_for_new_segment(None, text_after)
    if lower_label == SegmentLabels.TOC or upper_label == SegmentLabels.FRONT_MATTER:
        segment.label = SegmentLabels.FRONT_MATTER
    label = lower_label

    new_segment = OutlinerSegment(
        id=str(uuid.uuid4()),
        document_id=segment.document_id,
        text="",
        segment_index=segment.segment_index + 1,
        span_start=new_first_span_end,
        span_end=old_span_end,
        title=None,
        author=None,
        label=label,
        parent_segment_id=segment.parent_segment_id,
        status=segment.status or 'unchecked'
    )

    outliner_repo.execute_bump_segment_indices_after(
        db, segment.document_id, segment.segment_index
    )

    outliner_repo.add_segment(db, new_segment)
    apply_split_auto_title_author_parallel(segment, new_segment, text_before, text_after)
    segment.update_annotation_status()
    new_segment.update_annotation_status()
    outliner_repo.commit_session(db)

    return [segment, new_segment]


def merge_segments(
    db: Session,
    segment_ids: List[str]
) -> OutlinerSegment:
    """Merge multiple segments into one"""
    if len(segment_ids) < 2:
        raise HTTPException(status_code=400, detail="At least 2 segments required for merge")

    segments = outliner_repo.fetch_segments_ordered_by_ids(db, segment_ids)

    if len(segments) != len(segment_ids):
        raise HTTPException(status_code=404, detail="One or more segments not found")

    document_id = segments[0].document_id
    if not all(seg.document_id == document_id for seg in segments):
        raise HTTPException(status_code=400, detail="All segments must belong to same document")

    merged_title = next((seg.title for seg in segments if seg.title), None)
    merged_author = next((seg.author for seg in segments if seg.author), None)
    merged_title_bdrc_id = next((seg.title_bdrc_id for seg in segments if seg.title_bdrc_id), None)
    merged_author_bdrc_id = next((seg.author_bdrc_id for seg in segments if seg.author_bdrc_id), None)
    merged_parent_id = segments[0].parent_segment_id

    first_segment = segments[0]
    first_segment.text = ""
    first_segment.span_end = segments[-1].span_end
    first_segment.title = merged_title
    first_segment.author = merged_author
    first_segment.title_bdrc_id = merged_title_bdrc_id
    first_segment.author_bdrc_id = merged_author_bdrc_id
    first_segment.parent_segment_id = merged_parent_id
    first_segment.update_annotation_status()

    segments_to_delete_ids = [seg.id for seg in segments[1:]]

    for seg in segments[1:]:
        outliner_repo.delete_orm_entity(db, seg)

    following_segments = outliner_repo.fetch_following_segments_excluding_ids(
        db, document_id, first_segment.segment_index, segments_to_delete_ids
    )

    shift_amount = len(segments) - 1
    for seg in following_segments:
        seg.segment_index -= shift_amount

    outliner_repo.merge_segments_persist(db, first_segment)

    return first_segment
