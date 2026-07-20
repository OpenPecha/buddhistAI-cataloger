import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

BATCH_SIZE = 5
DATA_FILE = Path(__file__).with_name("data.json")
STATUS_FILE = Path(__file__).with_name("succeeded_count.json")


def skip_volume(volume_id: str) -> requests.Response:
    """
    Patch the BDRC API to set the given volume to skipped status.

    Args:
        volume_id (str): The id of the volume to skip.

    Returns:
        Response: The Response object from the PATCH request.
    """
    url = f"https://bec-otapi.bdrc.io/api/v1/volumes/{volume_id}/status?new_status=skipped"
    headers = {"accept": "application/json"}
    response = requests.patch(url, headers=headers)
    return response


def skip_one(volume_id: str) -> tuple[str, bool, int | None, str | None]:
    """Call the skip API for one id. Returns (id, success, status_code, error)."""
    try:
        response = skip_volume(volume_id)
        success = 200 <= response.status_code < 300
        error = None if success else response.text
        return volume_id, success, response.status_code, error
    except requests.RequestException as exc:
        return volume_id, False, None, str(exc)


def load_ids(path: Path = DATA_FILE) -> list[str]:
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        raise SystemExit(f"{path.name} is empty. Save the id list as a JSON array first.")
    data = json.loads(text)
    if not isinstance(data, list):
        raise SystemExit(f"{path.name} must be a JSON array of id strings.")
    return data


def load_status(path: Path = STATUS_FILE) -> dict[str, str]:
    if not path.exists():
        return {}
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        return {}
    return json.loads(text)


def save_status(status: dict[str, str], path: Path = STATUS_FILE) -> None:
    path.write_text(json.dumps(status, indent=2), encoding="utf-8")


def batched(items: list[str], size: int):
    for i in range(0, len(items), size):
        yield items[i : i + size]


def main() -> None:
    volume_ids = load_ids()
    status = load_status()

    # Skip ids already recorded as success (allows resume)
    pending = [vid for vid in volume_ids if status.get(vid) != "success"]

    total = len(volume_ids)
    print(f"Loaded {total} ids from {DATA_FILE.name}")
    print(f"Already done: {total - len(pending)}, remaining: {len(pending)}")

    for batch_num, batch in enumerate(batched(pending, BATCH_SIZE), start=1):
        print(f"Batch {batch_num}: {len(batch)} ids …")
        with ThreadPoolExecutor(max_workers=BATCH_SIZE) as executor:
            futures = {executor.submit(skip_one, vid): vid for vid in batch}
            for future in as_completed(futures):
                volume_id, success, status_code, error = future.result()
                status[volume_id] = "success" if success else "failed"
                save_status(status)

                if success:
                    print(f"  OK  {volume_id} ({status_code})")
                else:
                    print(f"  FAIL {volume_id} ({status_code}): {error}")

    succeeded = sum(1 for v in status.values() if v == "success")
    failed = sum(1 for v in status.values() if v == "failed")
    print(
        f"\nDone. {succeeded} success, {failed} failed. "
        f"Status written to {STATUS_FILE.name}"
    )


if __name__ == "__main__":
    main()
