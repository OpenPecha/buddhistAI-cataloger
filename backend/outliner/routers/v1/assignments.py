"""Assignment / queue routes under /api/v1/outliner/assignments."""

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from core.database import get_db
from outliner.controller.outliner import assign_volume as assign_volume_ctrl
from outliner.controller.outliner import list_documents as list_documents_ctrl
from outliner.deps import require_outliner_access
from outliner.routers import outliner as _legacy
from user.models.user import User

router = APIRouter(prefix="/assignments", tags=["outliner-v1-assignments"])


@router.post("/claim-next")
async def claim_next(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_outliner_access),
):
    return await assign_volume_ctrl(db, current_user.id)


@router.get("", response_model=List[_legacy.DocumentListResponse])
async def list_assignments(
    user_id: Optional[str] = Query(None, description="Filter documents assigned to this annotator"),
    status: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 100,
    include_deleted: bool = False,
    db: Session = Depends(get_db),
):
    """
    Documents for the work queue, same payload as GET /documents with optional user filter.
    """
    return list_documents_ctrl(
        db=db,
        user_id=user_id,
        status=status,
        skip=skip,
        limit=limit,
        include_deleted=include_deleted,
        title=None,
    )
