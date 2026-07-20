"""BDRC volume sync and document approval."""
import asyncio
import logging
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from bdrc.main import get_new_volume
from bdrc.volume import SegmentInput, VolumeInput, get_volume, update_volume, update_volume_status

from core.database import SessionLocal
from outliner.models.outliner import OutlinerDocument
from outliner.repository import outliner_repository as outliner_repo
from outliner.controller.document import (
    create_document,
    get_document,
    list_completed_document_ids_all_segments_checked,
    save_annotator_ai_final_segments,
    update_document_status,
)

# BDRC bulk sync progress: append-only log next to backend package (backend/sync_status.txt).
_SYNC_STATUS_LOG_PATH = Path(__file__).resolve().parents[2] / "sync_status.txt"

logger = logging.getLogger(__name__)


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


def _validate_document_has_bdrc_volume(document: OutlinerDocument) -> None:
    if not document.filename or not str(document.filename).strip():
        raise HTTPException(
            status_code=400,
            detail="Document has no BDRC volume ID (filename); cannot sync to BDRC",
        )


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

    if text is None or user_id is None:
        raise HTTPException(status_code=400, detail="Text or user_id is required")
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
        user_id=user_id,
    )

    await update_volume_status(volume_id, "in_progress")
    return document


# ==================== Approval Operations ====================

async def _push_document_segments_to_bdrc(
    document: OutlinerDocument,
    bdrc_status: str,
    modified_by: Optional[str] = None,
) -> Dict[str, Any]:
    """Sync document content and segments to BDRC OTAPI for the volume in document.filename."""
    _validate_document_has_bdrc_volume(document)
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
        segment_title = segment.reviewer_title if segment.reviewer_title is not None else (segment.title or "")
        segment_author = segment.reviewer_author if segment.reviewer_author is not None else (segment.author or "")
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


def _push_document_segments_to_bdrc_background(
    document_id: str,
    bdrc_status: str,
) -> None:
    """Run BDRC volume push off the request path; updates synced_to_bdrc when done."""
    db = SessionLocal()
    try:
        outliner_repo.set_document_synced_to_bdrc(db, document_id, False)
        document = get_document(db, document_id, include_segments=True)
        modified_by = _bdrc_modified_by_from_document(db, document)
        asyncio.run(
            _push_document_segments_to_bdrc(
                document, bdrc_status, modified_by=modified_by
            )
        )
        outliner_repo.set_document_synced_to_bdrc(db, document_id, True)
        logger.info(
            "BDRC background sync OK document_id=%s status=%s",
            document_id,
            bdrc_status,
        )
    except HTTPException as e:
        logger.warning(
            "BDRC background sync failed document_id=%s status=%s status_code=%s detail=%s",
            document_id,
            bdrc_status,
            e.status_code,
            e.detail,
        )
        try:
            outliner_repo.set_document_synced_to_bdrc(db, document_id, False)
        except Exception:
            logger.exception(
                "BDRC background sync: could not persist synced_to_bdrc=false for %s",
                document_id,
            )
            db.rollback()
    except Exception:
        logger.exception(
            "BDRC background sync failed document_id=%s status=%s",
            document_id,
            bdrc_status,
        )
        try:
            outliner_repo.set_document_synced_to_bdrc(db, document_id, False)
        except Exception:
            logger.exception(
                "BDRC background sync: could not persist synced_to_bdrc=false for %s",
                document_id,
            )
            db.rollback()
    finally:
        db.close()


def enqueue_push_document_segments_to_bdrc(
    document_id: str,
    bdrc_status: str,
) -> None:
    """Queue BDRC push on a daemon thread (same pattern as split auto title/author)."""
    threading.Thread(
        target=_push_document_segments_to_bdrc_background,
        args=(document_id, bdrc_status),
        daemon=True,
    ).start()


async def submit_document_to_bdrc_in_review(db: Session, document_id: str) -> Dict[str, Any]:
    """Queue BDRC in_review push in background, then set document status to completed."""
    document = get_document(db, document_id, include_segments=True)
    _validate_document_has_bdrc_volume(document)
    enqueue_push_document_segments_to_bdrc(document_id, "in_review")
    await update_document_status(db, document_id, "completed")
    save_annotator_ai_final_segments(db, document_id)
    return {"success": True}


async def sync_outliner_document_to_bdrc_in_review(db: Session, document_id: str) -> Dict[str, Any]:
    """Queue BDRC in_review push in background; leaves local outliner document status unchanged."""
    document = get_document(db, document_id, include_segments=True)
    _validate_document_has_bdrc_volume(document)
    enqueue_push_document_segments_to_bdrc(document_id, "in_review")
    return {"success": True, "queued": True}


async def sync_completed_documents_to_bdrc_in_review(
    db: Session,
    only_document_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    For each completed outliner document whose segments are all `checked`, queue a background
    BDRC push as `in_review`. Per-document validation failures are collected; queued documents
    update ``synced_to_bdrc`` when the worker finishes.
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

    queued: List[Dict[str, str]] = []
    failed: List[Dict[str, Any]] = []

    for i, document_id in enumerate(document_ids, start=1):
        filename = id_to_filename.get(document_id, "")
        sync_log.info(
            "BDRC bulk sync [%s/%s] queueing document_id=%s filename=%s",
            i,
            total,
            document_id,
            filename,
        )
        try:
            document = outliner_repo.fetch_document_by_id(db, document_id)
            if not document:
                failed.append(
                    {
                        "document_id": document_id,
                        "filename": filename,
                        "detail": "Document not found",
                        "status_code": 404,
                    }
                )
                sync_log.warning(
                    "BDRC bulk sync [%s/%s] FAILED document_id=%s filename=%s status_code=404 detail=Document not found",
                    i,
                    total,
                    document_id,
                    filename,
                )
                continue
            _validate_document_has_bdrc_volume(document)
            enqueue_push_document_segments_to_bdrc(document_id, "in_review")
            queued.append({"document_id": document_id, "filename": filename})
            sync_log.info(
                "BDRC bulk sync [%s/%s] QUEUED document_id=%s filename=%s",
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
        "BDRC bulk sync finished candidate_count=%s queued=%s failed=%s",
        total,
        len(queued),
        len(failed),
    )
    return {
        "candidate_count": len(document_ids),
        "queued": queued,
        "succeeded": queued,
        "failed": failed,
    }


async def approve_document(db: Session, document_id: str) -> Dict[str, Any]:
    document = get_document(db, document_id, include_segments=True)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    non_approved = outliner_repo.count_non_approved_segments(db, document_id)
    if non_approved > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve document: {non_approved} segment(s) are not yet approved",
        )

    _validate_document_has_bdrc_volume(document)
    enqueue_push_document_segments_to_bdrc(document_id, "reviewed")
    await update_document_status(db, document_id, "approved")
    outliner_repo.increment_document_submit_count(db, document_id)
    return {"success": True}
