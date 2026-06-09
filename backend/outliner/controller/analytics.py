"""Dashboard and annotator performance aggregates."""
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from sqlalchemy.orm import Session

from outliner.repository import outliner_repository as outliner_repo


def get_annotator_performance_breakdown(
    db: Session,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    user_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Per-annotator metrics for documents whose ``created_at`` falls in the date range.

    When dates are set, outcome metrics (rejections, approvals, review activity, corrections)
    are restricted to segment/rejection timestamps inside the same window so the range is not
    ignored for segment-level counts. Total ``segment_count`` remains all segments on those
    documents (not time-sliced). Optional ``user_id`` limits documents to one annotator (same
    scope as dashboard stats when that filter is applied).
    """
    return outliner_repo.get_annotator_performance_breakdown(
        db, start_date=start_date, end_date=end_date, user_id=user_id
    )


def get_dashboard_stats(
    db: Session,
    user_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    date_basis: Literal["created", "reviewed"] = "reviewed",
) -> Dict[str, Any]:
    """Aggregate dashboard statistics, optionally scoped by user and date range."""
    return outliner_repo.get_dashboard_stats(
        db, user_id=user_id, start_date=start_date, end_date=end_date, date_basis=date_basis
    )
