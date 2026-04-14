"""BDRC submission batch under /api/v1/outliner/submissions."""

from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import get_db
from outliner.controller.outliner import sync_completed_documents_to_bdrc_in_review

router = APIRouter(prefix="/submissions", tags=["outliner-v1-submissions"])


class BdrcBatchBody(BaseModel):
    document_ids: Optional[List[str]] = None


@router.post("/bdrc/batch")
async def bdrc_batch(body: BdrcBatchBody, db: Session = Depends(get_db)):
    only = body.document_ids if body.document_ids else None
    return await sync_completed_documents_to_bdrc_in_review(db, only_document_ids=only)
