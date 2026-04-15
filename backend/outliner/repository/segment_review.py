"""Pure helpers for segment review metadata (no DB I/O)."""
from datetime import datetime
from typing import Optional

from outliner.models.outliner import OutlinerSegment


def apply_segment_review_metadata(
    segment: OutlinerSegment,
    old_status: Optional[str],
    new_status: str,
    reviewer_id: Optional[str],
) -> None:
    """Track who set checked/approved; clear when segment is unchecked or rejected."""
    ns = (new_status or "").strip().lower()
    if ns in ("checked", "approved"):
        if reviewer_id:
            segment.reviewed_by_id = reviewer_id
            segment.reviewed_at = datetime.utcnow()
    elif ns in ("unchecked", "rejected"):
        segment.reviewed_by_id = None
        segment.reviewed_at = None


def _norm_segment_text(val: Optional[str]) -> str:
    return (val or "").strip()


def apply_segment_review_title_author_tracking(
    segment: OutlinerSegment,
    old_status: Optional[str],
    new_status: str,
) -> None:
    """
    When entering `checked`, snapshot title/author as the annotator submission.
    When moving `checked` -> `approved`, clear pre_review snapshots only; reviewer_title/author
    are set only via explicit PATCH (reviewer suggestions), not by overwriting annotator title/author.
    Clear snapshots and reviewer fields on unchecked/rejected (and when leaving approved to unchecked).
    """
    os = (old_status or "").strip().lower()
    ns = (new_status or "").strip().lower()

    if ns == "checked" and os in ("unchecked", "rejected", ""):
        segment.pre_review_title = segment.title
        segment.pre_review_author = segment.author
        return

    if ns == "approved" and os == "checked":
        segment.pre_review_title = None
        segment.pre_review_author = None
        return

    if ns in ("unchecked", "rejected"):
        segment.pre_review_title = None
        segment.pre_review_author = None
        segment.reviewer_title = None
        segment.reviewer_author = None
