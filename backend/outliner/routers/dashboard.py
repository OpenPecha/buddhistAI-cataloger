"""Routes under ``/outliner/dashboard``."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from core.database import get_db
from outliner.controller.active_batch import (
    get_active_batch as get_active_batch_ctrl,
    update_active_batch as update_active_batch_ctrl,
)
from outliner.controller.outliner import get_dashboard_stats as get_dashboard_stats_ctrl

from .schemas import ActiveBatchResponse, ActiveBatchUpdate, DashboardStatsResponse

router = APIRouter()


@router.get("/dashboard/stats", response_model=DashboardStatsResponse)
async def get_dashboard_stats(
    user_id: Optional[str] = Query(None, description="Filter by annotator user ID"),
    start_date: Optional[datetime] = Query(None, description="Start of date range (ISO format)"),
    end_date: Optional[datetime] = Query(None, description="End of date range (ISO format)"),
    db: Session = Depends(get_db),
):
    """Return aggregate stats for the admin overview dashboard."""
    return get_dashboard_stats_ctrl(db, user_id=user_id, start_date=start_date, end_date=end_date)


@router.get("/dashboard/active-batch", response_model=ActiveBatchResponse)
async def get_active_batch(db: Session = Depends(get_db)):
    """Return the admin-selected active BEC volume batch id, if any."""
    return get_active_batch_ctrl(db)


@router.put("/dashboard/active-batch", response_model=ActiveBatchResponse)
async def put_active_batch(body: ActiveBatchUpdate, db: Session = Depends(get_db)):
    """Set or clear the active BEC volume batch id."""
    return update_active_batch_ctrl(db, body.batch_id)
