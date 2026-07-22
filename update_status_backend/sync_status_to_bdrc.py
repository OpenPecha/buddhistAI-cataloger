"""
Sync cataloger document statuses to BDRC volume statuses for ids in all_ids.json.

App DB → BDRC mapping:
  approved  → reviewed
  completed → in_review
  active    → in_progress
  skipped   → skipped
  deleted   → skipped
"""

from __future__ import annotations

import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

BATCH_SIZE = 5
IDS_FILE = Path(__file__).with_name("all_ids.json")
STATUS_FILE = Path(__file__).with_name("sync_status.json")
BDRC_BASE = "https://bec-otapi.bdrc.io/api/v1/volumes"

# App document.status → BDRC new_status
STATUS_MAP: dict[str, str] = {
    "approved": "reviewed",
    "completed": "in_review",
    "active": "in_progress",
    "skipped": "skipped",
    "deleted": "skipped",
}


def _setup_backend_imports() -> None:
    backend = Path(__file__).resolve().parents[1] / "backend"
    sys.path.insert(0, str(backend))
    from dotenv import load_dotenv

    load_dotenv(backend / ".env", override=True)


def load_ids(path: Path = IDS_FILE) -> list[str]:
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        raise SystemExit(f"{path.name} is empty. Run generate list of ids.py first.")
    data = json.loads(text)
    if not isinstance(data, list):
        raise SystemExit(f"{path.name} must be a JSON array of id strings.")
    return [str(x) for x in data]


def load_progress(path: Path = STATUS_FILE) -> dict[str, str]:
    if not path.exists():
        return {}
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        return {}
    return json.loads(text)


def save_progress(progress: dict[str, str], path: Path = STATUS_FILE) -> None:
    path.write_text(json.dumps(progress, indent=2), encoding="utf-8")


def batched(items: list, size: int):
    for i in range(0, len(items), size):
        yield items[i : i + size]


def lookup_db_statuses(volume_ids: list[str]) -> dict[str, str | None]:
    """Return {volume_id: app_status_or_None_if_missing}."""
    from sqlalchemy import text

    from core.database import SessionLocal

    if not volume_ids:
        return {}

    db = SessionLocal()
    try:
        # Raw SQL avoids loading the full ORM relationship graph in this script.
        placeholders = ", ".join(f":id{i}" for i in range(len(volume_ids)))
        params = {f"id{i}": vid for i, vid in enumerate(volume_ids)}
        rows = db.execute(
            text(
                f"SELECT filename, status FROM outliner_documents "
                f"WHERE filename IN ({placeholders})"
            ),
            params,
        ).fetchall()
        found = {str(fn): (st or "active") for fn, st in rows if fn}
        return {vid: found.get(vid) for vid in volume_ids}
    finally:
        db.close()


def patch_bdrc_status(volume_id: str, new_status: str) -> requests.Response:
    url = f"{BDRC_BASE}/{volume_id}/status"
    return requests.patch(
        url,
        params={"new_status": new_status},
        headers={"accept": "application/json"},
        timeout=60,
    )


def sync_one(
    volume_id: str, app_status: str | None
) -> tuple[str, str, bool, int | None, str | None]:
    """
    Returns (volume_id, result_label, success, status_code, error).
    result_label is one of: success, failed, not_found, unmapped.
    """
    if app_status is None:
        return volume_id, "not_found", True, None, "no document with this filename in DB"

    bdrc_status = STATUS_MAP.get(app_status)
    if bdrc_status is None:
        return (
            volume_id,
            "unmapped",
            True,
            None,
            f"no BDRC mapping for app status '{app_status}'",
        )

    try:
        response = patch_bdrc_status(volume_id, bdrc_status)
        ok = 200 <= response.status_code < 300
        err = None if ok else response.text
        return volume_id, "success" if ok else "failed", ok, response.status_code, err
    except requests.RequestException as exc:
        return volume_id, "failed", False, None, str(exc)


def main() -> None:
    _setup_backend_imports()

    volume_ids = load_ids()
    progress = load_progress()

    done_labels = {"success", "not_found", "unmapped"}
    pending_ids = [vid for vid in volume_ids if progress.get(vid) not in done_labels]
    print(f"Loaded {len(volume_ids)} ids from {IDS_FILE.name}")
    print(f"Already done: {len(volume_ids) - len(pending_ids)}, remaining: {len(pending_ids)}")

    if not pending_ids:
        print("Nothing to do.")
        return

    print("Looking up document statuses in DB ...")
    db_statuses = lookup_db_statuses(pending_ids)
    status_counts: dict[str, int] = {}
    for st in db_statuses.values():
        key = st if st is not None else "(not in DB)"
        status_counts[key] = status_counts.get(key, 0) + 1
    print("Pending by app status:", status_counts)

    work = [(vid, db_statuses[vid]) for vid in pending_ids]

    for batch_num, batch in enumerate(batched(work, BATCH_SIZE), start=1):
        print(f"Batch {batch_num}: {len(batch)} ids ...")
        with ThreadPoolExecutor(max_workers=BATCH_SIZE) as executor:
            futures = {
                executor.submit(sync_one, vid, app_st): (vid, app_st)
                for vid, app_st in batch
            }
            for future in as_completed(futures):
                volume_id, app_st = futures[future]
                _, label, ok, code, error = future.result()
                progress[volume_id] = label
                save_progress(progress)

                bdrc = STATUS_MAP.get(app_st or "", "?")
                if label == "success":
                    print(f"  OK  {volume_id}  app={app_st} -> bdrc={bdrc} ({code})")
                elif label in ("not_found", "unmapped"):
                    print(f"  SKIP {volume_id}  {error}")
                else:
                    print(f"  FAIL {volume_id}  app={app_st} -> bdrc={bdrc} ({code}): {error}")

    counts: dict[str, int] = {}
    for v in progress.values():
        counts[v] = counts.get(v, 0) + 1
    print(f"\nDone. {counts}. Progress written to {STATUS_FILE.name}")


if __name__ == "__main__":
    main()
