"""Map OpenPecha API v2 JSON to legacy cataloger shapes expected by routers."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

LICENSE_ALIASES = {
    "cc0": "cc0",
    "public": "public",
    "cc-by": "cc-by",
    "cc_by": "cc-by",
    "cc-by-sa": "cc-by-sa",
    "cc-by-nd": "cc-by-nd",
    "cc-by-nc": "cc-by-nc",
    "cc-by-nc-sa": "cc-by-nc-sa",
    "cc-by-nc-nd": "cc-by-nc-nd",
    "copyrighted": "copyrighted",
    "unknown": "unknown",
}


def normalize_license(value: Optional[str]) -> str:
    if not value:
        return "public"
    k = value.strip().lower().replace(" ", "-").replace("_", "-")
    return LICENSE_ALIASES.get(k, "unknown")





def text_output_to_legacy(text_out: Dict[str, Any]) -> Dict[str, Any]:
    print(text_out)
    target = text_out.get("translation_of") or text_out.get("commentary_of")
    return {
        "id": text_out["id"],
        "title": text_out.get("title") or {},
        "language": text_out.get("language", ""),
        "target": target,
        "contributions": text_out.get("contributions") or [],
        "date": text_out.get("date"),
        "bdrc": text_out.get("bdrc"),
        "wiki": text_out.get("wiki"),
        "category_id": text_out.get("category_id"),
        "created_at": text_out.get("created_at"),
        "updated_at": text_out.get("updated_at"),
    }


def wrap_text_list(raw: Any, *, limit: int, offset: int) -> Dict[str, Any]:
    if isinstance(raw, dict) and "results" in raw:
        return raw
    rows = raw if isinstance(raw, list) else []
    legacy = [text_output_to_legacy(r) if isinstance(r, dict) else r for r in rows]
    return {"results": legacy, "count": len(legacy)}





def patch_text_payload_from_legacy(body: Dict[str, Any]) -> Dict[str, Any]:
    """Map cataloger UpdateText to v2 TextPatch."""
    out: Dict[str, Any] = {}
    for k in ("bdrc", "wiki", "date", "title", "language", "category_id"):
        if k in body and body[k] is not None:
            out[k] = body[k]
    if body.get("license") is not None:
        out["license"] = normalize_license(body["license"])
    if body.get("contributions") is not None:
        out["contributions"] = body["contributions"]
    alt = body.get("alt_title")
    if alt:
        out["alt_titles"] = alt
    return out


def edition_output_to_instance_list_item(ed: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": ed["id"],
        "type": ed.get("type", ""),
        "source": ed.get("source"),
        "bdrc": ed.get("bdrc"),
        "wiki": ed.get("wiki"),
        "colophon": ed.get("colophon"),
        "incipit_title": ed.get("incipit_title"),
        "alt_incipit_titles": ed.get("alt_incipit_titles") or [],
    }


def annotation_bundle_to_legacy_refs(bundle: Dict[str, Any]) -> List[Dict[str, str]]:
    refs: List[Dict[str, str]] = []
    for key, typ in (
        ("segmentations", "segmentation"),
        ("alignments", "alignment"),
        ("pagination", "pagination"),
    ):
        val = bundle.get(key)
        if isinstance(val, list):
            for item in val:
                if isinstance(item, dict) and item.get("id"):
                    refs.append({"annotation_id": item["id"], "type": typ})
        elif isinstance(val, dict) and val.get("id"):
            refs.append({"annotation_id": val["id"], "type": typ})
    for item in bundle.get("bibliographic_metadata") or []:
        if isinstance(item, dict) and item.get("id"):
            refs.append({"annotation_id": item["id"], "type": "bibliography"})
    for item in bundle.get("durchen_notes") or []:
        if isinstance(item, dict) and item.get("id"):
            refs.append({"annotation_id": item["id"], "type": "durchen"})
    return refs


def bibliography_items_from_bundle(bundle: Dict[str, Any]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for item in bundle.get("bibliographic_metadata") or []:
        if not isinstance(item, dict):
            continue
        span = item.get("span") or {}
        btype = item.get("type")
        if span and btype:
            out.append({"span": span, "type": btype})
    return out


def build_legacy_instance_view(
    edition_meta: Dict[str, Any],
    content: str,
    ann_bundle: Dict[str, Any],
) -> Dict[str, Any]:
    eid = edition_meta.get("id", "")
    return {
        "content": content,
        "metadata": {
            "id": eid,
            "type": edition_meta.get("type", ""),
            "copyright": "",
            "bdrc": edition_meta.get("bdrc"),
            "wiki": edition_meta.get("wiki"),
            "colophon": edition_meta.get("colophon"),
            "incipit_title": edition_meta.get("incipit_title"),
            "alt_incipit_titles": edition_meta.get("alt_incipit_titles"),
        },
        "annotations": ann_bundle,
    }


def segmentation_from_legacy_annotation_list(
    annotation: List[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    spans: List[Dict[str, Any]] = []
    for item in annotation:
        if not isinstance(item, dict):
            continue
        if "alignment_index" in item or item.get("type") == "alignment":
            continue
        sp = item.get("span")
        if isinstance(sp, dict) and "start" in sp and "end" in sp:
            spans.append(sp)
    if not spans:
        return None
    segments = [{"lines": [sp]} for sp in spans]
    return {"segments": segments}


def edition_metadata_from_legacy(meta: Dict[str, Any]) -> Dict[str, Any]:
    etype = meta.get("type") or "diplomatic"
    if etype not in ("diplomatic", "critical", "collated"):
        etype = "diplomatic"
    out: Dict[str, Any] = {"type": etype}
    for k in ("bdrc", "wiki", "source", "colophon", "incipit_title", "alt_incipit_titles"):
        if meta.get(k) is not None:
            out[k] = meta[k]
    return out


def bibliographic_request_from_legacy(
    items: Optional[List[Dict[str, Any]]],
) -> Optional[List[Dict[str, Any]]]:
    if not items:
        return None
    mapped: List[Dict[str, Any]] = []
    for b in items:
        if not isinstance(b, dict):
            continue
        span = b.get("span")
        btype = b.get("type")
        if isinstance(span, dict) and btype:
            mapped.append({"span": span, "type": btype})
    return mapped or None


def alignment_output_to_legacy_data(a: Dict[str, Any]) -> Dict[str, Any]:
    target_annotation: List[Dict[str, Any]] = []
    for i, seg in enumerate(a.get("target_segments") or []):
        if not isinstance(seg, dict):
            continue
        lines = seg.get("lines") or []
        if lines:
            target_annotation.append({"span": lines[0], "index": i})
    alignment_annotation: List[Dict[str, Any]] = []
    for i, al in enumerate(a.get("aligned_segments") or []):
        if not isinstance(al, dict):
            continue
        lines = al.get("lines") or []
        if lines:
            alignment_annotation.append(
                {
                    "span": lines[0],
                    "index": i,
                    "alignment_index": al.get("alignment_indices") or [],
                }
            )
    return {
        "target_annotation": target_annotation,
        "alignment_annotation": alignment_annotation,
    }


def segmentation_output_to_legacy_data(s: Dict[str, Any]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for seg in s.get("segments") or []:
        if not isinstance(seg, dict):
            continue
        lines = seg.get("lines") or []
        if lines:
            out.append({"span": lines[0]})
    return out


def alignment_request_from_legacy_segments(
    target_annotation: Optional[List[Dict[str, Any]]],
    alignment_annotation: Optional[List[Dict[str, Any]]],
    source_edition_id: str,
) -> Optional[Dict[str, Any]]:
    """Build v2 AlignmentInput; source_edition_id is the edition being translated from (route param)."""
    if not target_annotation or not alignment_annotation:
        return None
    target_segments = []
    for t in target_annotation:
        if isinstance(t, dict) and t.get("span"):
            target_segments.append({"lines": [t["span"]]})
    aligned = []
    for a in alignment_annotation:
        if not isinstance(a, dict) or not a.get("span"):
            continue
        aligned.append(
            {
                "lines": [a["span"]],
                "alignment_indices": a.get("alignment_index") or [],
            }
        )
    if not target_segments or not aligned:
        return None
    return {
        "target_id": source_edition_id,
        "target_segments": target_segments,
        "aligned_segments": aligned,
    }
