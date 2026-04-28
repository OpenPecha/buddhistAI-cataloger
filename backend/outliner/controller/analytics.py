"""Dashboard and annotator performance aggregates."""
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from outliner.repository import outliner_repository as outliner_repo


def get_annotator_performance_breakdown(
    db: Session,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    """
    Per-annotator metrics for documents whose ``created_at`` falls in the date range.

    When dates are set, outcome metrics (rejections, approvals, review activity, corrections)
    are restricted to segment/rejection timestamps inside the same window so the range is not
    ignored for segment-level counts. Total ``segment_count`` remains all segments on those
    documents (not time-sliced).
    """
    return outliner_repo.get_annotator_performance_breakdown(
        db, start_date=start_date, end_date=end_date
    )


def get_dashboard_stats(
    db: Session,
    user_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> Dict[str, Any]:
    """Aggregate dashboard statistics, optionally scoped by user and date range."""
    return outliner_repo.get_dashboard_stats(
        db, user_id=user_id, start_date=start_date, end_date=end_date
    )
