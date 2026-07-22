"""Collect all volume ids from batches/*.json into a single JSON array."""

import json
from pathlib import Path

BATCHES_DIR = Path(__file__).with_name("batches")
OUT_FILE = Path(__file__).with_name("all_ids.json")


def main() -> None:
    ids: list[str] = []
    seen: set[str] = set()

    batch_files = sorted(BATCHES_DIR.glob("batch*.json"))
    if not batch_files:
        raise SystemExit(f"No batch*.json files found in {BATCHES_DIR}")

    for path in batch_files:
        text = path.read_text(encoding="utf-8").strip()
        if not text:
            print(f"{path.name}: empty, skipped")
            continue
        data = json.loads(text)
        if not isinstance(data, list):
            raise SystemExit(f"{path.name} must be a JSON array")
        added = 0
        for item in data:
            vid = item.get("id") if isinstance(item, dict) else None
            if not vid or vid in seen:
                continue
            seen.add(vid)
            ids.append(vid)
            added += 1
        print(f"{path.name}: {len(data)} items ({added} new ids)")

    OUT_FILE.write_text(json.dumps(ids, indent=2), encoding="utf-8")
    print(f"\nWrote {len(ids)} unique ids to {OUT_FILE.name}")


if __name__ == "__main__":
    main()
