"""Admin stats under /api/v1/outliner/admin."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from core.database import get_db
from outliner.controller.outliner import get_dashboard_stats as get_dashboard_stats_ctrl
from outliner.routers import outliner as _legacy

router = APIRouter(prefix="/admin", tags=["outliner-v1-admin"])


@router.get("/stats", response_model=_legacy.DashboardStatsResponse)
async def admin_stats(
    user_id: Optional[str] = Query(None, description="Filter by annotator user ID"),
    start_date: Optional[datetime] = Query(None, description="Start of date range (ISO format)"),
    end_date: Optional[datetime] = Query(None, description="End of date range (ISO format)"),
    db: Session = Depends(get_db),
):
    return get_dashboard_stats_ctrl(db, user_id=user_id, start_date=start_date, end_date=end_date)
