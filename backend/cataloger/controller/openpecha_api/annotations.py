from typing import Any, Callable, Dict, List, Literal, Optional, Tuple

import requests
from fastapi import HTTPException

from cataloger.controller.openpecha_api.base import json_headers, openpecha_headers, openpecha_url
from cataloger.controller.openpecha_api.v2_adapters import (
    alignment_output_to_legacy_data,
    segmentation_output_to_legacy_data,
)


def _try_get(url: str, *, timeout: Optional[int] = None) -> Optional[requests.Response]:
    kw: Dict[str, Any] = {}
    if timeout is not None:
        kw["timeout"] = timeout
    r = requests.get(url, headers=openpecha_headers(), **kw)
    if r.status_code == 200:
        return r
    return None


def get_annotation(annotation_id: str, *, timeout: Optional[int] = None) -> Any:
    bases: List[Tuple[str, Callable[[Dict[str, Any]], Dict[str, Any]]]] = [
        (
            "annotations/alignment",
            lambda b: {"data": alignment_output_to_legacy_data(b)},
        ),
        ("annotations/segmentation", lambda b: {"data": segmentation_output_to_legacy_data(b)}),
        ("annotations/pagination", lambda b: {"data": b}),
        ("annotations/bibliographic", lambda b: {"data": b}),
        ("annotations/durchen", lambda b: {"data": b}),
    ]
    for path_prefix, wrap in bases:
        r = _try_get(
            openpecha_url(path_prefix, annotation_id),
            timeout=timeout,
        )
        if r:
            body = r.json()
            merged = wrap(body) if isinstance(body, dict) else {"data": body}
            eid = body.get("id") if isinstance(body, dict) else None
            merged.setdefault("id", eid or annotation_id)
            return merged
    raise HTTPException(status_code=404, detail="Annotation not found for v2 typed paths")


def update_annotation_body(annotation_id: str, payload: Dict[str, Any]) -> Any:
    del annotation_id, payload
    raise HTTPException(
        status_code=501,
        detail="OpenPecha v2 has no generic annotation update; delete and recreate via edition annotations.",
    )


def create_annotation_for_instance(instance_id: str, payload: Dict[str, Any]) -> Any:
    """instance_id is an edition id; maps legacy union payload to AnnotationRequestInput."""
    ptype = payload.get("type")
    ann: Dict[str, Any] = {}
    if ptype == "segmentation" and payload.get("annotation"):
        segs = []
        for item in payload["annotation"]:
            if isinstance(item, dict) and item.get("span"):
                segs.append({"lines": [item["span"]]})
        if segs:
            ann["segmentation"] = {"segments": segs}
    elif ptype == "alignment":
        ta = payload.get("target_annotation") or []
        aa = payload.get("alignment_annotation") or []
        target_segments = [
            {"lines": [x["span"]]} for x in ta if isinstance(x, dict) and x.get("span")
        ]
        aligned_segments = []
        for x in aa:
            if isinstance(x, dict) and x.get("span"):
                aligned_segments.append(
                    {
                        "lines": [x["span"]],
                        "alignment_indices": x.get("alignment_index") or [],
                    }
                )
        tid = payload.get("target_manifestation_id") or payload.get("target_id")
        if not tid:
            raise HTTPException(status_code=400, detail="alignment requires target_manifestation_id")
        ann["alignment"] = {
            "target_id": tid,
            "target_segments": target_segments,
            "aligned_segments": aligned_segments,
        }
    elif ptype == "table_of_contents":
        ann["pagination"] = {"volume": {"pages": payload.get("annotation") or []}}
    if not ann:
        raise HTTPException(
            status_code=400,
            detail="Unsupported or empty annotation payload for v2",
        )
    r = requests.post(
        openpecha_url("editions", instance_id, "annotations"),
        json=ann,
        headers=json_headers(),
        timeout=120,
    )
    if r.status_code not in (200, 201):
        raise HTTPException(status_code=r.status_code, detail=r.text)
    return r.json()



annotationTypes = Literal["alignments", "segmentations", "paginations", "bibliographic", "durchens"]
def delete_annotation(type: annotationTypes, annotation_id: str) -> Any:
    url = openpecha_url(type, annotation_id)
    r = requests.delete(url, headers=openpecha_headers(), timeout=60)
    if r.status_code not in (200, 204):
        raise HTTPException(status_code=r.status_code, detail=r.text)
    return {"status": "deleted", "annotation_id": annotation_id}