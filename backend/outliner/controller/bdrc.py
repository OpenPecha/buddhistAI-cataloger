"""BDRC volume sync and document approval."""
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from bdrc.main import get_new_volume
from bdrc.volume import SegmentInput, VolumeInput, get_volume, update_volume, update_volume_status

from outliner.models.outliner import OutlinerDocument
from outliner.repository import outliner_repository as outliner_repo
from outliner.controller.document import (
    create_document,
    get_document,
    list_completed_document_ids_all_segments_checked,
    update_document_status,
)

# BDRC bulk sync progress: append-only log next to backend package (backend/sync_status.txt).
_SYNC_STATUS_LOG_PATH = Path(__file__).resolve().parents[2] / "sync_status.txt"


def _bdrc_bulk_sync_file_logger() -> logging.Logger:
    """Logger that writes BDRC bulk sync progress to sync_status.txt (handlers attached once)."""
    log = logging.getLogger("outliner.bdrc_bulk_sync_status")
    log.setLevel(logging.INFO)
    if not log.handlers:
        fh = logging.FileHandler(_SYNC_STATUS_LOG_PATH, encoding="utf-8", mode="a")
        fh.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
        )
        log.addHandler(fh)
    log.propagate = False
    return log

def _bdrc_modified_by_from_document(db: Session, document: OutlinerDocument) -> Optional[str]:
    """BDRC OTAPI `modified_by`: prefer catalog user email, else user id (same pattern as frontend BDRC modals)."""
    return outliner_repo.bdrc_modified_by_from_document(db, document)


async def assign_volume(db: Session, user_id: str) -> OutlinerDocument:
    """Assign a volume to a document"""
    volume_data = await get_new_volume()
    if volume_data is None:
        raise HTTPException(status_code=400, detail="No volume found")
    chunks = volume_data["chunks"]
    text = ""
    for chunk in chunks:
        if chunk["text_bo"] is not None:
            text += chunk["text_bo"]
            
    # create a new document with the text
    if text is None or user_id is None:
        raise HTTPException(status_code=400, detail="Text or user_id is required")
    # check if the document already exists
    volume_id = volume_data["id"]
    
    if outliner_repo.fetch_document_by_filename(db, volume_id):
        raise HTTPException(
            status_code=400,
            detail=f"Document already exists for volume {volume_id}",
        )
    
    document = create_document(
            db=db,
            content=text,
            filename=volume_id,
            user_id=user_id
        )
   
    # update the volume status to "in_progress"
    await update_volume_status(volume_id, "in_progress")
    return document
    
    
    
    
    
# ==================== Approval Operations ====================

async def _push_document_segments_to_bdrc(
    document: OutlinerDocument,
    bdrc_status: str,
    modified_by: Optional[str] = None,
) -> Dict[str, Any]:
    """Sync document content and segments to BDRC OTAPI for the volume in document.filename."""
    if not document.filename or not str(document.filename).strip():
        raise HTTPException(
            status_code=400,
            detail="Document has no BDRC volume ID (filename); cannot sync to BDRC",
        )
    volume_id = str(document.filename).strip()
    volume = await get_volume(volume_id)
    rep_id = volume["rep_id"]
    vol_id = volume["vol_id"]
    vol_version = volume["vol_version"]
    base_text = document.content
    db_segments = document.segments
    segment_inputs = []
    for segment in db_segments:
        segment_start = int(segment.span_start)
        segment_end = int(segment.span_end)
        segment_title = segment.title or ""
        segment_author = segment.author
        mw_id = f'{volume["mw_id"]}_{segment.id}'
        wa_id = segment.title_bdrc_id or ''
        segment_inputs.append(SegmentInput(
            cstart=segment_start,
            cend=segment_end,
            title_bo=segment_title,
            author_name_bo=segment_author,
            mw_id=mw_id,
            wa_id=wa_id,
            part_type="text" if wa_id != '' else "editorial"
        ))
    return await update_volume(
        volume_id,
        VolumeInput(
            rep_id=rep_id,
            vol_id=vol_id,
            vol_version=vol_version,
            status=bdrc_status,
            base_text=base_text,
            segments=segment_inputs,
        ),
    )


async def submit_document_to_bdrc_in_review(db: Session, document_id: str) -> Dict[str, Any]:
    """Push current outline to BDRC with status in_review, then set document status to completed."""
    document = get_document(db, document_id, include_segments=True)
    modified_by = _bdrc_modified_by_from_document(db, document)
    bdrc_response = await _push_document_segments_to_bdrc(
        document, "in_review", modified_by=modified_by
    )
    update_document_status(db, document_id, "completed")
    return {"success":True}


async def sync_outliner_document_to_bdrc_in_review(db: Session, document_id: str) -> Dict[str, Any]:
    """Push outline to BDRC with status in_review; leaves local outliner document status unchanged."""
    document = get_document(db, document_id, include_segments=True)
    modified_by = _bdrc_modified_by_from_document(db, document)
    return await _push_document_segments_to_bdrc(
        document, "in_review", modified_by=modified_by
    )


async def sync_completed_documents_to_bdrc_in_review(
    db: Session,
    only_document_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    For each completed outliner document whose segments are all `checked`, push volume to BDRC as `in_review`.
    Per-document failures are collected; successful syncs still apply.
    Progress is appended to backend/sync_status.txt.

    If `only_document_ids` is set, only those IDs are considered (must still satisfy completed / filename / all-checked).
    """
    sync_log = _bdrc_bulk_sync_file_logger()
    document_ids = list_completed_document_ids_all_segments_checked(db, only_document_ids=only_document_ids)
    total = len(document_ids)
    id_to_filename = outliner_repo.map_document_id_to_filename(db, document_ids)

    sync_log.info(
        "BDRC bulk sync start candidate_count=%s filter_document_ids=%s document_ids=%s",
        total,
        only_document_ids,
        document_ids,
    )

    succeeded: List[Dict[str, str]] = []
    failed: List[Dict[str, Any]] = []

    for i, document_id in enumerate(document_ids, start=1):
        filename = id_to_filename.get(document_id, "")
        sync_log.info(
            "BDRC bulk sync [%s/%s] pushing document_id=%s filename=%s",
            i,
            total,
            document_id,
            filename,
        )
        try:
            await sync_outliner_document_to_bdrc_in_review(db, document_id)
            succeeded.append({"document_id": document_id, "filename": filename})
            sync_log.info(
                "BDRC bulk sync [%s/%s] OK document_id=%s filename=%s",
                i,
                total,
                document_id,
                filename,
            )
        except HTTPException as e:
            detail = e.detail
            if not isinstance(detail, str):
                detail = str(detail)
            failed.append(
                {
                    "document_id": document_id,
                    "filename": filename,
                    "detail": detail,
                    "status_code": e.status_code,
                }
            )
            sync_log.warning(
                "BDRC bulk sync [%s/%s] FAILED document_id=%s filename=%s status_code=%s detail=%s",
                i,
                total,
                document_id,
                filename,
                e.status_code,
                detail,
            )
        except (TimeoutError, ConnectionError, RuntimeError) as e:
            failed.append({"document_id": document_id, "filename": filename, "detail": str(e)})
            sync_log.warning(
                "BDRC bulk sync [%s/%s] FAILED document_id=%s filename=%s error=%s",
                i,
                total,
                document_id,
                filename,
                e,
                exc_info=True,
            )
        except Exception as e:
            failed.append({"document_id": document_id, "filename": filename, "detail": str(e)})
            sync_log.exception(
                "BDRC bulk sync [%s/%s] FAILED document_id=%s filename=%s unexpected error",
                i,
                total,
                document_id,
                filename,
            )

    sync_log.info(
        "BDRC bulk sync finished candidate_count=%s succeeded=%s failed=%s",
        total,
        len(succeeded),
        len(failed),
    )
    return {
        "candidate_count": len(document_ids),
        "succeeded": succeeded,
        "failed": failed,
    }


async def approve_document(db: Session, document_id: str) -> OutlinerDocument:
    document = get_document(db, document_id , include_segments=True)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    non_approved = outliner_repo.count_non_approved_segments(db, document_id)
    if non_approved > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve document: {non_approved} segment(s) are not yet approved"
        )

    modified_by = _bdrc_modified_by_from_document(db, document)
    response_bdrc = await _push_document_segments_to_bdrc(
        document, "reviewed", modified_by=modified_by
    )
    update_document_status(db, document_id, "approved")
    outliner_repo.increment_document_submit_count(db, document_id)
    return response_bdrc
