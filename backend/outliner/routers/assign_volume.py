"""Top-level ``/outliner/assign_volume`` route."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from outliner.controller.outliner import assign_volume as assign_volume_ctrl
from outliner.deps import require_outliner_access
from user.models.user import User

router = APIRouter()


@router.post("/assign_volume")
async def assign_volume(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_outliner_access),
):
    """Assign a volume to a document"""
    document = await assign_volume_ctrl(db, current_user.id)
    return document
