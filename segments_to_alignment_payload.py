"""
Build OpenPecha-style alignment payloads from parallel segment lists.

Spans are cumulative over source_segments joined with "" and target_segments joined with ""
(no newlines between lines), matching editor text split with split("\\n").

Final payload keeps only indices where both sides exist and both spans are
non-empty (start < end). One-sided or zero-length rows are omitted.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Span:
    start: int
    end: int


@dataclass
class TargetRow:
    """Spans on source text (API field name: target_annotation)."""

    index: str
    span: Span


@dataclass
class AlignRow:
    """Spans on translation text. alignment_index omitted for synthetic padding rows."""

    index: str
    span: Span
    alignment_index: list[str] | None = None


def _cleaned_alignments(
    targets: list[TargetRow],
    alignments: list[AlignRow],
) -> tuple[list[TargetRow], list[AlignRow]]:
    out_t: list[TargetRow] = []
    out_a: list[AlignRow] = []
    n = max(len(targets), len(alignments))
    for i in range(n + 1):
        target = targets[i] if i < len(targets) else None
        alignment = alignments[i] if i < len(alignments) else None
        if target is None and alignment is None:
            continue
        if target is not None and alignment is not None:
            out_t.append(target)
            out_a.append(alignment)
        elif target is not None:
            out_t.append(target)
            out_a.append(
                AlignRow(
                    index=target.index,
                    span=Span(start=target.span.start, end=target.span.start),
                )
            )
        else:
            assert alignment is not None
            out_a.append(alignment)
            out_t.append(
                TargetRow(
                    index=alignment.index,
                    span=Span(start=alignment.span.start, end=alignment.span.start),
                )
            )
    return out_t, out_a


def generate_alignment(
    source_segments: list[str],
    target_segments: list[str],
) -> tuple[list[TargetRow], list[AlignRow]]:
    targets: list[TargetRow] = []
    cursor = 0
    for i, text in enumerate(source_segments):
        length = len(text)
        start, end = cursor, cursor + length
        targets.append(TargetRow(index=str(i), span=Span(start, end)))
        if length > 0:
            cursor = end

    alignments: list[AlignRow] = []
    cursor = 0
    for i, text in enumerate(target_segments):
        length = len(text)
        start, end = cursor, cursor + length
        si = str(i)
        alignments.append(
            AlignRow(
                index=si,
                span=Span(start, end),
                alignment_index=[si],
            )
        )
        if length > 0:
            cursor = end

    return _cleaned_alignments(targets, alignments)


def _parse_index(s: str) -> int:
    return int(s, 10)


def _numeric_payload(
    targets: list[TargetRow],
    alignments: list[AlignRow],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    target_annotation = [
        {"span": {"start": t.span.start, "end": t.span.end}, "index": _parse_index(t.index)}
        for t in targets
    ]
    alignment_annotation = []
    for a in alignments:
        if a.alignment_index is None:
            continue
        alignment_annotation.append(
            {
                "span": {"start": a.span.start, "end": a.span.end},
                "index": _parse_index(a.index),
                "alignment_index": [
                    _parse_index(x) if isinstance(x, str) else int(x) for x in a.alignment_index
                ],
            }
        )
    return target_annotation, alignment_annotation


def _span_non_empty(span: dict[str, int]) -> bool:
    return span["start"] < span["end"]


def filter_to_mutually_paired_rows(
    target_annotation: list[dict[str, Any]],
    alignment_annotation: list[dict[str, Any]],
) -> dict[str, Any]:
    t_by = {t["index"]: t for t in target_annotation}
    a_by = {a["index"]: a for a in alignment_annotation}
    all_idx = sorted(set(t_by) | set(a_by))
    paired_old: list[int] = []
    for idx in all_idx:
        t = t_by.get(idx)
        a = a_by.get(idx)
        if t is None or a is None:
            continue
        if not _span_non_empty(t["span"]) or not _span_non_empty(a["span"]):
            continue
        paired_old.append(idx)

    out_t = []
    out_a = []
    for n, old in enumerate(paired_old):
        t = t_by[old]
        a = a_by[old]
        out_t.append({"span": dict(t["span"]), "index": n})
        out_a.append(
            {
                "span": dict(a["span"]),
                "index": n,
                "alignment_index": [n],
            }
        )
    return {"target_annotation": out_t, "alignment_annotation": out_a}


def segments_to_merged_api_payload(
    source_segments: list[str],
    target_segments: list[str],
) -> dict[str, Any]:
    """
    Full pipeline: segment strings → API-shaped dict with only mutual non-empty pairs.
    """
    raw_t, raw_a = generate_alignment(source_segments, target_segments)
    num_t, num_a = _numeric_payload(raw_t, raw_a)
    return filter_to_mutually_paired_rows(num_t, num_a)


def segments_to_numeric_before_pairing(
    source_segments: list[str],
    target_segments: list[str],
) -> dict[str, Any]:
    raw_t, raw_a = generate_alignment(source_segments, target_segments)
    num_t, num_a = _numeric_payload(raw_t, raw_a)
    return {"target_annotation": num_t, "alignment_annotation": num_a}


def _assert_no_degenerate(payload: dict[str, Any]) -> None:
    for t in payload["target_annotation"]:
        if t["span"]["start"] >= t["span"]["end"]:
            raise AssertionError(f"degenerate target: {t}")
    for a in payload["alignment_annotation"]:
        if a["span"]["start"] >= a["span"]["end"]:
            raise AssertionError(f"degenerate alignment: {a}")


def _run_tests() -> None:
    r = segments_to_merged_api_payload(
        ["hello", "tashi", "dawa"],
        ["tashi", "hello", ""],
    )
    assert len(r["target_annotation"]) == 2
    assert len(r["alignment_annotation"]) == 2
    assert r["target_annotation"][0]["span"] == {"start": 0, "end": 5}
    assert r["target_annotation"][1]["span"] == {"start": 5, "end": 10}
    assert r["alignment_annotation"][1]["alignment_index"] == [1]
    _assert_no_degenerate(r)

    r = segments_to_merged_api_payload(
        ["kunsang", "is", "", "the", "best"],
        ["name", "", "what", "the", "data"],
    )
    assert len(r["target_annotation"]) == 3
    assert r["target_annotation"][0]["span"] == {"start": 0, "end": 7}
    assert r["target_annotation"][1]["span"] == {"start": 9, "end": 12}
    assert r["target_annotation"][2]["span"] == {"start": 12, "end": 16}
    _assert_no_degenerate(r)

    r = segments_to_merged_api_payload(["a", "b", "c"], ["x", "y"])
    assert len(r["target_annotation"]) == 2

    r = segments_to_merged_api_payload(["single"], ["one"])
    assert r["target_annotation"][0]["index"] == 0
    assert r["alignment_annotation"][0]["alignment_index"] == [0]
    _assert_no_degenerate(r)

    print("segments_to_alignment_payload: all tests passed.")


if __name__ == "__main__":
    _run_tests()
