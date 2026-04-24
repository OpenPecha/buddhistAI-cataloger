"""HTTP client for optional BEC OT API aggregates used on the admin dashboard."""

import logging
from typing import Any, Dict, Optional

import httpx

from core.config import BEC_OTAPI_BASE_URL

logger = logging.getLogger(__name__)

_DEFAULT_TIMEOUT_S = 15.0


def fetch_volume_batch_stats(max_batches: int = 5000) -> Optional[Dict[str, Dict[str, int]]]:
    """
    GET ``/api/v1/stats/volume-batches``.

    Returns ``{ batch_id: { in_review, reviewed, in_progress, active } }`` or ``None`` on failure.
    """
    base = BEC_OTAPI_BASE_URL.rstrip("/")
    url = f"{base}/api/v1/stats/volume-batches"
    try:
        with httpx.Client(timeout=_DEFAULT_TIMEOUT_S) as client:
            response = client.get(
                url,
                params={"max_batches": max_batches},
                headers={"accept": "application/json"},
            )
            response.raise_for_status()
            payload: Any = response.json()
    except (httpx.HTTPError, ValueError, TypeError) as exc:
        logger.warning("BEC OT API volume-batches fetch failed: %s", exc)
        return None

    if not isinstance(payload, dict):
        return None

    out: Dict[str, Dict[str, int]] = {}
    for batch_id, counts in payload.items():
        if not isinstance(counts, dict):
            continue
        try:
            out[str(batch_id)] = {
                "in_review": int(counts.get("in_review") or 0),
                "reviewed": int(counts.get("reviewed") or 0),
                "in_progress": int(counts.get("in_progress") or 0),
                "active": int(counts.get("active") or 0),
            }
        except (TypeError, ValueError):
            continue

    return out
