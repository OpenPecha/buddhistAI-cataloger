"""Transactional bulk create/update/delete for segments within one document."""
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from outliner.models.outliner import OutlinerDocument, OutlinerSegment
from outliner.repository.segment_queries import (
    fetch_segments_by_ids_for_document,
    fetch_segments_for_bulk_update,
    max_segment_index,
)
from outliner.repository.segment_rejection import handle_segment_leaving_rejected_status
from outliner.repository.segment_review import (
    apply_segment_review_metadata,
    apply_segment_review_title_author_tracking,
)
from outliner.utils.outliner_utils import infer_segment_label_for_new_segment, validate_segment_status_transition


def run_bulk_segment_ops(
    db: Session,
    document: OutlinerDocument,
    create: Optional[List[Dict[str, Any]]] = None,
    update: Optional[List[Dict[str, Any]]] = None,
    delete: Optional[List[str]] = None,
) -> List[OutlinerSegment]:
    """Same behavior as former controller bulk_segment_operations DB logic."""
    document_id = document.id
    result_segments: List[OutlinerSegment] = []

    if delete:
        segments_to_delete = fetch_segments_by_ids_for_document(db, delete, document_id)

        if len(segments_to_delete) != len(delete):
            found_ids = {seg.id for seg in segments_to_delete}
            missing_ids = set(delete) - found_ids
            raise ValueError(f"Some segments not found: {list(missing_ids)}")

        deleted_indices = {seg.segment_index for seg in segments_to_delete}
        max_deleted_index = max(deleted_indices) if deleted_indices else -1

        for seg in segments_to_delete:
            db.delete(seg)

        if max_deleted_index >= 0:
            following_segments = db.query(OutlinerSegment).filter(
                OutlinerSegment.document_id == document_id,
                OutlinerSegment.segment_index > max_deleted_index,
            ).all()

            shift_amount = len(segments_to_delete)
            for seg in following_segments:
                seg.segment_index -= shift_amount

    if update:
        segment_updates = {
            update_item.get("id"): update_item for update_item in update if "id" in update_item
        }
        segment_ids_to_update = list(segment_updates.keys())

        segments_to_update = fetch_segments_for_bulk_update(
            db, segment_ids_to_update, document_id
        )

        if len(segments_to_update) != len(segment_ids_to_update):
            found_ids = {seg.id for seg in segments_to_update}
            missing_ids = set(segment_ids_to_update) - found_ids
            raise ValueError(f"Some segments not found for update: {list(missing_ids)}")

        for segment in segments_to_update:
            update_data = segment_updates[segment.id]
            old_status = segment.status

            if "title" in update_data and update_data["title"] is not None:
                segment.title = update_data["title"]
            if "author" in update_data and update_data["author"] is not None:
                segment.author = update_data["author"]
            if "title_bdrc_id" in update_data and update_data["title_bdrc_id"] is not None:
                segment.title_bdrc_id = update_data["title_bdrc_id"]
            if "author_bdrc_id" in update_data and update_data["author_bdrc_id"] is not None:
                segment.author_bdrc_id = update_data["author_bdrc_id"]
            if "parent_segment_id" in update_data and update_data["parent_segment_id"] is not None:
                segment.parent_segment_id = update_data["parent_segment_id"]
            if "is_attached" in update_data and update_data["is_attached"] is not None:
                segment.is_attached = update_data["is_attached"]
            if "status" in update_data and update_data["status"] is not None:
                new_st = update_data["status"]
                prev_st = segment.status
                is_valid, error_msg = validate_segment_status_transition(
                    segment.status, new_st
                )
                if not is_valid:
                    raise ValueError(error_msg)
                apply_segment_review_metadata(
                    segment,
                    prev_st,
                    new_st,
                    update_data.get("reviewer_id"),
                )
                apply_segment_review_title_author_tracking(segment, prev_st, new_st)
                segment.status = new_st
            if "span_start" in update_data and update_data["span_start"] is not None:
                segment.span_start = update_data["span_start"]
            if "span_end" in update_data and update_data["span_end"] is not None:
                segment.span_end = update_data["span_end"]
            if "segment_index" in update_data and update_data["segment_index"] is not None:
                segment.segment_index = update_data["segment_index"]

            segment.update_annotation_status()
            segment.updated_at = datetime.utcnow()
            if old_status == "rejected" and segment.status != "rejected":
                handle_segment_leaving_rejected_status(
                    db,
                    segment.id,
                    reviewer_undo=bool(update_data.get("reviewer_id")),
                )
            result_segments.append(segment)

    if create:
        max_index = max_segment_index(db, document_id)
        new_segments = []
        for idx, segment_data in enumerate(create):
            segment_index = (
                segment_data.get("segment_index")
                if segment_data.get("segment_index") is not None
                else max_index + idx + 1
            )

            segment_text = segment_data.get("text")
            if not segment_text:
                span_start = segment_data["span_start"]
                span_end = segment_data["span_end"]
                if span_start < 0 or span_end > len(document.content):
                    raise ValueError(
                        f"Invalid span addresses for segment at index {segment_index}"
                    )
                segment_text = document.content[span_start:span_end]

            db_segment = OutlinerSegment(
                id=str(uuid.uuid4()),
                document_id=document_id,
                text="",
                segment_index=segment_index,
                span_start=segment_data["span_start"],
                span_end=segment_data["span_end"],
                title=segment_data.get("title"),
                author=segment_data.get("author"),
                title_bdrc_id=segment_data.get("title_bdrc_id"),
                author_bdrc_id=segment_data.get("author_bdrc_id"),
                parent_segment_id=segment_data.get("parent_segment_id"),
                label=infer_segment_label_for_new_segment(
                    segment_data.get("title"), segment_text
                ),
                status="unchecked",
            )
            db_segment.update_annotation_status()
            new_segments.append(db_segment)
            db.add(db_segment)

        result_segments.extend(new_segments)

    db.commit()

    for seg in result_segments:
        db.refresh(seg)

    return result_segments
