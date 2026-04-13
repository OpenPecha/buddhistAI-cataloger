"""
Server-side title/author auto-fill (Gemini).

Only segments labeled **TEXT** are eligible.

- Title: inferred from the **start** of segment text (label → TEXT, or new TEXT segment from split).
- Author: inferred from the **end** of segment text when a **following** segment exists
  (e.g. after a split), and only for TEXT segments.
"""
from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from outliner.models.outliner import OutlinerSegment, SegmentLabels
from outliner.utils.outliner_utils import get_document_with_cache, segment_body_from_document

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
    doc = get_document_with_cache(db, segment.document_id)
    content = (doc.content or "") if doc else ""
    text = segment_body_from_document(content, segment.span_start, segment.span_end)
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
    span = find_phrase_doc_span(text, seg_start, title_val)
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
    doc = get_document_with_cache(db, segment.document_id)
    content = (doc.content or "") if doc else ""
    text = segment_body_from_document(content, segment.span_start, segment.span_end)
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
    span = find_last_phrase_doc_span(text, seg_start, author_val)
    if span:
        segment.author_span_start, segment.author_span_end = span
    else:
        segment.author_span_start = None
        segment.author_span_end = None
    segment.updated_author = None
    return True


def _gemini_title_safe(text: str) -> Any:
    try:
        from cataloger.controller.ai import generate_title_from_start
        from cataloger.routers.ai import TitleOnlyResponse

        return generate_title_from_start(text, TitleOnlyResponse)
    except Exception as e:  # pragma: no cover
        logger.warning("segment_title_author_auto: parallel title AI failed: %s", e)
        return None


def _gemini_author_safe(text: str) -> Any:
    try:
        from cataloger.controller.ai import generate_author_from_end
        from cataloger.routers.ai import AuthorOnlyResponse

        return generate_author_from_end(text, AuthorOnlyResponse)
    except Exception as e:  # pragma: no cover
        logger.warning("segment_title_author_auto: parallel author AI failed: %s", e)
        return None


def _apply_title_from_raw(segment: OutlinerSegment, text: str, raw: Any) -> bool:
    if raw is None:
        return False
    title_val = _resolved_title(raw)
    if not title_val:
        return False
    seg_start = segment.span_start or 0
    segment.title = title_val
    span = find_phrase_doc_span(text, seg_start, title_val)
    if span:
        segment.title_span_start, segment.title_span_end = span
    else:
        segment.title_span_start = None
        segment.title_span_end = None
    segment.updated_title = None
    return True


def _apply_author_from_raw(segment: OutlinerSegment, text: str, raw: Any) -> bool:
    if raw is None:
        return False
    author_val = _resolved_author(raw)
    if not author_val:
        return False
    seg_start = segment.span_start or 0
    segment.author = author_val
    span = find_last_phrase_doc_span(text, seg_start, author_val)
    if span:
        segment.author_span_start, segment.author_span_end = span
    else:
        segment.author_span_start = None
        segment.author_span_end = None
    segment.updated_author = None
    return True


def apply_split_auto_title_author_parallel(
    segment: OutlinerSegment,
    new_segment: OutlinerSegment,
    text_before: str,
    text_after: str,
) -> None:
    """
    Run up to three Gemini calls concurrently (upper title, upper author, lower title).
    Same eligibility rules as apply_auto_title_to_segment / apply_auto_author_to_segment
    with skip_last_segment_check=True.
    """
    want_upper_title = (
        segment.label == SegmentLabels.TEXT
        and (segment.status or "") != "checked"
        and not (segment.title or "").strip()
        and bool(text_before.strip())
    )
    want_upper_author = (
        segment.label == SegmentLabels.TEXT
        and (segment.status or "") != "checked"
        and not (segment.author or "").strip()
        and bool(text_before.strip())
    )
    want_lower_title = (
        new_segment.label == SegmentLabels.TEXT
        and (new_segment.status or "") != "checked"
        and not (new_segment.title or "").strip()
        and bool(text_after.strip())
    )

    if not (want_upper_title or want_upper_author or want_lower_title):
        return

    future_to_key: dict[Any, str] = {}
    max_workers = int(want_upper_title) + int(want_upper_author) + int(want_lower_title)
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        if want_upper_title:
            future_to_key[executor.submit(_gemini_title_safe, text_before)] = "upper_title"
        if want_upper_author:
            future_to_key[executor.submit(_gemini_author_safe, text_before)] = "upper_author"
        if want_lower_title:
            future_to_key[executor.submit(_gemini_title_safe, text_after)] = "lower_title"

        raw_by_key: dict[str, Any] = {}
        for fut in as_completed(future_to_key):
            key = future_to_key[fut]
            try:
                raw_by_key[key] = fut.result()
            except Exception as e:  # pragma: no cover
                logger.warning("segment_title_author_auto: parallel task %s failed: %s", key, e)
                raw_by_key[key] = None

    if want_upper_title:
        _apply_title_from_raw(segment, text_before, raw_by_key.get("upper_title"))
    if want_upper_author:
        _apply_author_from_raw(segment, text_before, raw_by_key.get("upper_author"))
    if want_lower_title:
        _apply_title_from_raw(new_segment, text_after, raw_by_key.get("lower_title"))
