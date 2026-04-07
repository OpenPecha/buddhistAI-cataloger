"""
Server-side title/author auto-fill (Gemini).

Only segments labeled **TEXT** are eligible.

- Title: inferred from the **start** of segment text (label → TEXT, or new TEXT segment from split).
- Author: inferred from the **end** of segment text when a **following** segment exists
  (e.g. after a split), and only for TEXT segments.
"""
from __future__ import annotations

import logging
from typing import Any, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from outliner.models.outliner import OutlinerSegment, SegmentLabels

logger = logging.getLogger(__name__)


def find_phrase_doc_span(
    segment_text: str, segment_doc_start: int, phrase: str
) -> Optional[Tuple[int, int]]:
    """First occurrence of phrase in segment text → document-level [start, end)."""
    trimmed = phrase.strip()
    if not trimmed:
        return None
    idx = segment_text.find(trimmed)
    match = trimmed
    if idx == -1 and phrase != trimmed:
        idx = segment_text.find(phrase)
        match = phrase
    if idx == -1:
        return None
    end = idx + len(match)
    return (segment_doc_start + idx, segment_doc_start + end)


def find_last_phrase_doc_span(
    segment_text: str, segment_doc_start: int, phrase: str
) -> Optional[Tuple[int, int]]:
    """Last occurrence (e.g. colophon at end) → document-level span."""
    trimmed = phrase.strip()
    if not trimmed:
        return None
    idx = segment_text.rfind(trimmed)
    match = trimmed
    if idx == -1 and phrase != trimmed:
        idx = segment_text.rfind(phrase)
        match = phrase
    if idx == -1:
        return None
    end = idx + len(match)
    return (segment_doc_start + idx, segment_doc_start + end)


def _resolved_title(data: Any) -> str:
    if hasattr(data, "model_dump"):
        d = data.model_dump()
    elif isinstance(data, dict):
        d = data
    else:
        d = {
            "title": getattr(data, "title", None),
            "suggested_title": getattr(data, "suggested_title", None),
        }
    return (d.get("title") or "").strip() or (d.get("suggested_title") or "").strip()


def _resolved_author(data: Any) -> str:
    if hasattr(data, "model_dump"):
        d = data.model_dump()
    elif isinstance(data, dict):
        d = data
    else:
        d = {
            "author": getattr(data, "author", None),
            "suggested_author": getattr(data, "suggested_author", None),
        }
    return (d.get("author") or "").strip() or (d.get("suggested_author") or "").strip()


def is_last_segment_in_document(db: Session, segment: OutlinerSegment) -> bool:
    """True if this segment has the highest ``segment_index`` in its document."""
    max_idx = (
        db.query(func.max(OutlinerSegment.segment_index))
        .filter(OutlinerSegment.document_id == segment.document_id)
        .scalar()
    )
    if max_idx is None:
        return True
    return int(segment.segment_index) == int(max_idx)


def apply_auto_title_to_segment(
    db: Session,
    segment: OutlinerSegment,
    *,
    skip_last_segment_check: bool = False,
) -> bool:
    """
    Title from the **start** of the segment. Skips if title already set.

    Only runs when the segment is labeled TEXT.

    Returns True if title fields were written.
    """
    if not skip_last_segment_check and is_last_segment_in_document(db, segment):
        return False
    if segment.label != SegmentLabels.TEXT:
        return False
    if (segment.status or "") == "checked":
        return False
    text = segment.text or ""
    if not text.strip():
        return False
    if (segment.title or "").strip():
        return False

    try:
        from cataloger.controller.ai import generate_title_from_start
        from cataloger.routers.ai import TitleOnlyResponse
    except Exception as e:  # pragma: no cover
        logger.warning("segment_title_author_auto: import failed: %s", e)
        return False

    try:
        raw = generate_title_from_start(text, TitleOnlyResponse)
    except Exception as e:
        logger.warning(
            "segment_title_author_auto: title AI failed for segment %s: %s",
            segment.id,
            e,
        )
        return False

    title_val = _resolved_title(raw)
    if not title_val:
        return False

    seg_start = segment.span_start or 0
    segment.title = title_val
    span = find_phrase_doc_span(segment.text, seg_start, title_val)
    if span:
        segment.title_span_start, segment.title_span_end = span
    else:
        segment.title_span_start = None
        segment.title_span_end = None
    segment.updated_title = None
    return True


def apply_auto_author_to_segment(
    db: Session,
    segment: OutlinerSegment,
    *,
    skip_last_segment_check: bool = False,
) -> bool:
    """
    Author from the **end** of the segment. Skips if author already set.

    Intended when a following segment is created (split), so the end boundary is known.
    Only runs when the segment is labeled TEXT.

    Returns True if author fields were written.
    """
    if not skip_last_segment_check and is_last_segment_in_document(db, segment):
        return False
    if segment.label != SegmentLabels.TEXT:
        return False
    if (segment.status or "") == "checked":
        return False
    text = segment.text or ""
    if not text.strip():
        return False
    if (segment.author or "").strip():
        return False

    try:
        from cataloger.controller.ai import generate_author_from_end
        from cataloger.routers.ai import AuthorOnlyResponse
    except Exception as e:  # pragma: no cover
        logger.warning("segment_title_author_auto: import failed: %s", e)
        return False

    try:
        raw = generate_author_from_end(text, AuthorOnlyResponse)
    except Exception as e:
        logger.warning(
            "segment_title_author_auto: author AI failed for segment %s: %s",
            segment.id,
            e,
        )
        return False

    author_val = _resolved_author(raw)
    if not author_val:
        return False

    seg_start = segment.span_start or 0
    segment.author = author_val
    span = find_last_phrase_doc_span(segment.text, seg_start, author_val)
    if span:
        segment.author_span_start, segment.author_span_end = span
    else:
        segment.author_span_start = None
        segment.author_span_end = None
    segment.updated_author = None
    return True
