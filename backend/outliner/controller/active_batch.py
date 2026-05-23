"""HTTP-facing logic for active BEC volume batch selection."""

from __future__ import annotations

from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from outliner.repository import active_batch as active_batch_repo


def get_active_batch(db: Session) -> Dict[str, Any]:
    bid = active_batch_repo.get_active_batch_id(db)
    return {"batch_id": bid}


def update_active_batch(db: Session, batch_id: Optional[str]) -> Dict[str, Any]:
    active_batch_repo.set_active_batch_id(db, batch_id)
    return {"batch_id": batch_id}
