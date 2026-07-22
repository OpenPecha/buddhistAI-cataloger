"""ORM model for outliner_ai_outline_runs (frozen AI outline predictions)."""
from __future__ import annotations

from datetime import datetime
from typing import Any
import uuid

from sqlalchemy import DateTime, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class OutlinerAiOutlineRun(Base):
    """A snapshot of the AI's predicted segment split, frozen when the AI button is clicked.

    One row per AI-button click; never overwritten. ``segments`` holds the predicted
    spans as ``[{"segment_index": int, "span_start": int, "span_end": int}, ...]`` —
    character offsets into ``outliner_documents.content``. ``detector`` records which
    backend produced the split (``"rule"`` or ``"mmbert"``). Compared against the
    annotator's final submission for benchmarking the outline model.
    """

    __tablename__ = "outliner_ai_outline_runs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("outliner_documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    segments: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    detector: Mapped[str] = mapped_column(String, nullable=False, default="rule")
    created_by_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
