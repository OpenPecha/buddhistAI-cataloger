"""Presentation-ready dashboard structures for the admin overview UI."""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from user.models.user import User

DOC_STATUS_ORDER = (
    "active",
    "completed",
    "approved",
    "rejected",
    "skipped",
    "deleted",
    "unknown",
)
SEG_STATUS_ORDER = ("unchecked", "checked", "approved", "rejected")


def _round_pct(numerator: float, denominator: float) -> float:
    if denominator <= 0:
        return 0.0
    return round((numerator / denominator) * 1000) / 10


def _sort_keys(keys: List[str], preferred: Tuple[str, ...]) -> List[str]:
    pref = [k for k in preferred if k in keys]
    rest = sorted(k for k in keys if k not in preferred)
    return pref + rest


def _format_chart_label(key: str) -> str:
    if key == "TOC":
        return "TOC"
    if key == "unset":
        return "Unset"
    if key == "unknown":
        return "Unknown"
    if key == "approved":
        return "Reviewed"
    if key == "checked":
        return "Annotated"
    if key == "unchecked":
        return "Annotating"
    if key == "completed":
        return "Annotated"
    if key == "active":
        return "Annotating"
    parts = key.replace("_", " ").split()
    return " ".join(p[:1].upper() + p[1:] if p else "" for p in parts)


def _segment_status_label_for_footer(key: str) -> str:
    mapping = {
        "unchecked": "Annotating",
        "checked": "Annotated",
        "approved": "Reviewed (current)",
        "rejected": "Rejected",
    }
    return mapping.get(key, _format_chart_label(key))


def _load_display_names(db: Session, user_ids: List[Optional[str]]) -> Dict[str, str]:
    ids = {uid for uid in user_ids if uid}
    if not ids:
        return {}
    rows = db.query(User.id, User.name).filter(User.id.in_(ids)).all()
    out: Dict[str, str] = {}
    for uid, name in rows:
        n = (name or "").strip()
        out[str(uid)] = n if n else str(uid)
    return out


def _display_name(
    user_id: Optional[str],
    names: Dict[str, str],
) -> str:
    if user_id is None or user_id == "":
        return "Unassigned"
    return names.get(user_id, user_id)


def _chart_series_from_counts(
    counts: Dict[str, int],
    preferred_order: Tuple[str, ...],
) -> Optional[Dict[str, Any]]:
    entries = [(k, v) for k, v in counts.items() if v > 0]
    if not entries:
        return None
    keys = _sort_keys([k for k, _ in entries], preferred_order)
    return {
        "labels": [_format_chart_label(k) for k in keys],
        "values": [counts.get(k, 0) for k in keys],
        "keys": keys,
    }


def build_dashboard_presentation(
    db: Session,
    stats: Dict[str, Any],
) -> Dict[str, Any]:
    """Turn raw dashboard aggregates into structures ready for the admin overview UI."""
    doc_status = stats.get("document_status_counts") or {}
    seg_status = stats.get("segment_status_counts") or {}
    label_counts = stats.get("segment_label_counts") or {}
    # Annotator quality uses annotator_performance only (all segments; approved counts
    # are status == approved, not limited to segments with annotator title/author).
    perf: List[Dict[str, Any]] = list(stats.get("annotator_performance") or [])
    reviewer_rows: List[Dict[str, Any]] = list(stats.get("reviewer_segment_activity") or [])
    volume_raw = stats.get("volume_batch_stats")

    all_user_ids: List[Optional[str]] = []
    for r in perf:
        all_user_ids.append(r.get("user_id"))
    for r in reviewer_rows:
        all_user_ids.append(r.get("user_id"))
    names = _load_display_names(db, all_user_ids)

    skipped_docs = int(doc_status.get("skipped") or 0)
    reviewer_corrections = int(stats.get("segments_reviewer_corrected_title_or_author") or 0)

    overview_bar = {
        "labels": [
            "Documents",
            "Total segments",
            "With title/author",
            "Skipped docs",
            "Unresolved rejected",
            "Reviewer title/author edits",
        ],
        "values": [
            int(stats.get("document_count") or 0),
            int(stats.get("total_segments") or 0),
            int(stats.get("segments_with_title_or_author") or 0),
            skipped_docs,
            int(stats.get("rejection_count") or 0),
            reviewer_corrections,
        ],
    }

    seg_footer_keys = _sort_keys(
        list({*SEG_STATUS_ORDER, *seg_status.keys()}),
        SEG_STATUS_ORDER,
    )
    segment_status_footer = [
        {
            "key": k,
            "label": _segment_status_label_for_footer(k),
            "count": int(seg_status.get(k) or 0),
        }
        for k in seg_footer_keys
    ]

    label_entries = sorted(
        ((k, int(v)) for k, v in label_counts.items() if v > 0),
        key=lambda x: x[1],
        reverse=True,
    )
    segment_label_chart = None
    if label_entries:
        segment_label_chart = {
            "labels": [_format_chart_label(k) for k, _ in label_entries],
            "values": [v for _, v in label_entries],
            "keys": [k for k, _ in label_entries],
        }

    annotator_quality = _build_annotator_quality(perf, names)
    annotator_workload = _build_annotator_workload(perf, names)
    reviewer_activity = _build_reviewer_activity(reviewer_rows, names)
    volume_batches = _build_volume_batches(volume_raw)

    return {
        "overview_bar": overview_bar,
        "document_status_chart": _chart_series_from_counts(doc_status, DOC_STATUS_ORDER),
        "segment_status_chart": _chart_series_from_counts(seg_status, SEG_STATUS_ORDER),
        "segment_status_footer": segment_status_footer,
        "segment_label_chart": segment_label_chart,
        "document_status_breakdown": {
            "approved": int(doc_status.get("approved") or 0),
            "completed": int(doc_status.get("completed") or 0),
            "active": int(doc_status.get("active") or 0),
            "skipped": skipped_docs,
        },
        "annotator_quality": annotator_quality,
        "annotator_workload": annotator_workload,
        "reviewer_activity": reviewer_activity,
        "volume_batches": volume_batches,
    }


def _build_annotator_quality(
    perf: List[Dict[str, Any]],
    names: Dict[str, str],
) -> Optional[Dict[str, Any]]:
    if not perf:
        return None

    rows: List[Dict[str, Any]] = []
    for r in perf:
        segments = int(r.get("segment_count") or 0)
        approved = int(r.get("segments_approved") or 0)
        # Drop ghost rows: reviewers/others picked up by group-by-reviewer queries
        # who aren't actually annotators in scope (no documents and no approved work).
        if segments == 0 and approved == 0:
            continue
        events = int(r.get("rejection_event_count") or 0)
        edits = int(r.get("segments_reviewer_corrected_title_or_author") or 0)
        # Denominator: approved segments with annotator title/author in range
        # (matches the 'Reviewed with title/author (in period)' top-card stat).
        rejection_pct = _round_pct(events, approved)
        edits_pct = _round_pct(edits, approved)
        rows.append(
            {
                **r,
                "events": events,
                "edits": edits,
                "approved": approved,
                "rejection_pct": rejection_pct,
                "edits_pct": edits_pct,
                "display_name": _display_name(r.get("user_id"), names),
            }
        )

    if not rows:
        return None

    rows.sort(
        key=lambda x: (
            -(x["events"] + x["edits"]),
            -x["rejection_pct"],
            -x["edits_pct"],
        )
    )

    table_rows = [
        {
            "user_id": r.get("user_id"),
            "name": r["display_name"],
            "segments": int(r.get("segment_count") or 0),
            "segments_approved": r["approved"],
            "rejection_events": r["events"],
            "rejection_pct": r["rejection_pct"],
            "correction_edits": r["edits"],
            "corrections_pct": r["edits_pct"],
        }
        for r in rows
    ]

    return {
        "chart": {
            "labels": [r["display_name"] for r in rows],
            "rejection_pct": [r["rejection_pct"] for r in rows],
            "rejection_meta": [
                {"events": r["events"], "approved": r["approved"]} for r in rows
            ],
            "edits_pct": [r["edits_pct"] for r in rows],
            "edits_meta": [{"edits": r["edits"], "approved": r["approved"]} for r in rows],
            "segment_counts": [int(r.get("segment_count") or 0) for r in rows],
            "approved_counts": [r["approved"] for r in rows],
        },
        "table_rows": table_rows,
    }


def _build_annotator_workload(
    perf: List[Dict[str, Any]],
    names: Dict[str, str],
) -> Optional[Dict[str, Any]]:
    if not perf:
        return None

    labels = [_display_name(r.get("user_id"), names) for r in perf]
    return {
        "labels": labels,
        "series": [
            {
                "label": "Segments",
                "values": [int(r.get("segment_count") or 0) for r in perf],
            },
            {
                "label": "Title / author",
                "values": [int(r.get("segments_with_title_or_author") or 0) for r in perf],
            },
            {
                "label": "Unresolved rejected",
                "values": [int(r.get("rejection_count") or 0) for r in perf],
            },
            {
                "label": "Reviewed (as reviewer)",
                "values": [int(r.get("segments_reviewed") or 0) for r in perf],
            },
            {
                "label": "Rejections logged",
                "values": [int(r.get("reviewer_rejection_count") or 0) for r in perf],
            },
            {
                "label": "Reviewer title/author edits",
                "values": [
                    int(r.get("segments_reviewer_corrected_title_or_author") or 0)
                    for r in perf
                ],
            },
        ],
    }


def _build_reviewer_activity(
    reviewer_rows: List[Dict[str, Any]],
    names: Dict[str, str],
) -> Dict[str, Any]:
    active = [
        r
        for r in reviewer_rows
        if (
            int(r.get("segments_recorded_as_reviewer") or 0) > 0
            or int(r.get("reviewed_segments_with_title_or_author") or 0) > 0
            or int(r.get("reviewer_title_author_edits") or 0) > 0
            or int(r.get("reviewer_rejection_count") or 0) > 0
        )
    ]

    if not active:
        return {
            "has_activity": False,
            "chart": None,
            "table_rows": [],
        }

    sorted_rows = sorted(
        active,
        key=lambda r: (
            -(
                int(r.get("segments_recorded_as_reviewer") or 0)
                + int(r.get("reviewer_title_author_edits") or 0)
                + int(r.get("reviewer_rejection_count") or 0)
            ),
            -int(r.get("segments_recorded_as_reviewer") or 0),
            -int(r.get("reviewer_rejection_count") or 0),
        ),
    )

    total_reviewed = sum(int(r.get("segments_recorded_as_reviewer") or 0) for r in sorted_rows)
    max_reviewed = max(int(r.get("segments_recorded_as_reviewer") or 0) for r in sorted_rows)
    max_with_title = max(
        int(r.get("reviewed_segments_with_title_or_author") or 0) for r in sorted_rows
    )
    max_edits = max(int(r.get("reviewer_title_author_edits") or 0) for r in sorted_rows)
    max_rejections = max(int(r.get("reviewer_rejection_count") or 0) for r in sorted_rows)

    table_rows: List[Dict[str, Any]] = []
    for r in sorted_rows:
        segments_reviewed = int(r.get("segments_recorded_as_reviewer") or 0)
        with_title_author = int(r.get("reviewed_segments_with_title_or_author") or 0)
        title_author_edits = int(r.get("reviewer_title_author_edits") or 0)
        rejections = int(r.get("reviewer_rejection_count") or 0)
        table_rows.append(
            {
                "user_id": r.get("user_id"),
                "name": _display_name(r.get("user_id"), names),
                "segments_reviewed": segments_reviewed,
                "with_title_author": with_title_author,
                "title_author_edits": title_author_edits,
                "rejections": rejections,
                "reviewed_share_pct": _round_pct(segments_reviewed, total_reviewed),
                "with_title_author_rate_pct": _round_pct(
                    with_title_author, segments_reviewed
                ),
                "edits_rate_pct": _round_pct(title_author_edits, segments_reviewed),
                "rejections_rate_pct": _round_pct(rejections, segments_reviewed),
                "reviewed_bar_pct": (
                    (segments_reviewed / max_reviewed) * 100 if max_reviewed > 0 else 0.0
                ),
                "with_title_author_bar_pct": (
                    (with_title_author / max_with_title) * 100 if max_with_title > 0 else 0.0
                ),
                "edits_bar_pct": (
                    (title_author_edits / max_edits) * 100 if max_edits > 0 else 0.0
                ),
                "rejections_bar_pct": (
                    (rejections / max_rejections) * 100 if max_rejections > 0 else 0.0
                ),
            }
        )

    return {
        "has_activity": True,
        "chart": {
            "labels": [_display_name(r.get("user_id"), names) for r in sorted_rows],
            "segments_reviewed": [
                int(r.get("segments_recorded_as_reviewer") or 0) for r in sorted_rows
            ],
            "with_title_author": [
                int(r.get("reviewed_segments_with_title_or_author") or 0)
                for r in sorted_rows
            ],
            "title_author_edits": [
                int(r.get("reviewer_title_author_edits") or 0) for r in sorted_rows
            ],
            "rejections": [int(r.get("reviewer_rejection_count") or 0) for r in sorted_rows],
        },
        "table_rows": table_rows,
    }


def _build_volume_batches(
    volume_raw: Optional[Dict[str, Dict[str, int]]],
) -> Dict[str, Any]:
    if volume_raw is None:
        return {
            "state": "unavailable",
            "rows": [],
            "total_active": 0,
            "show_low_batch_warning": False,
        }
    if not volume_raw:
        return {
            "state": "empty",
            "rows": [],
            "total_active": 0,
            "show_low_batch_warning": False,
        }

    rows: List[Dict[str, Any]] = []
    for batch_id, counts in volume_raw.items():
        rows.append(
            {
                "batch_id": str(batch_id),
                "in_review": int(counts.get("in_review") or 0),
                "reviewed": int(counts.get("reviewed") or 0),
                "in_progress": int(counts.get("in_progress") or 0),
                "active": int(counts.get("active") or 0),
            }
        )

    def _sort_key(row: Dict[str, Any]) -> Tuple[int, str]:
        try:
            return (0, f"{int(row['batch_id']):020d}")
        except (TypeError, ValueError):
            return (1, row["batch_id"])

    rows.sort(key=_sort_key)
    total_active = sum(int(r.get("active") or 0) for r in rows)
    return {
        "state": "rows",
        "rows": rows,
        "total_active": total_active,
        "show_low_batch_warning": total_active < 50,
    }
