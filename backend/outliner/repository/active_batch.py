"""Persistence for the singleton ``active_batch`` row (current BEC volume batch id)."""

from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from outliner.models.active_batch import ActiveBatch


def get_active_batch_id(db: Session) -> Optional[str]:
    row = db.query(ActiveBatch).order_by(ActiveBatch.id).first()
    return str(row.batch_id) if row else None


def set_active_batch_id(db: Session, batch_id: Optional[str]) -> None:
    row = db.query(ActiveBatch).order_by(ActiveBatch.id).first()
    if row:
        if batch_id is not None:
            row.batch_id = str(batch_id)
        else:
            db.delete(row)
    elif batch_id is not None:
        db.add(ActiveBatch(batch_id=str(batch_id)))
   