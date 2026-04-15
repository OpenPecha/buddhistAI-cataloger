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
    Per-annotator metrics for documents in the date range (ignores user_id filter).
    Scoped by document.created_at. user_id None = unassigned documents.
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
