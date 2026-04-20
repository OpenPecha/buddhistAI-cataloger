from typing import Any, Dict, List, Optional

import requests
from fastapi import HTTPException

from cataloger.controller.openpecha_api.base import json_headers, openpecha_headers, openpecha_url
from cataloger.controller.openpecha_api.texts import (
    _post_edition_annotations,
    fetch_edition_annotation,
    fetch_edition_content,
    fetch_edition_metadata,
    get_text,
)
from cataloger.controller.openpecha_api.v2_adapters import (
    alignment_request_from_legacy_segments,
    bibliographic_request_from_legacy,
    build_legacy_instance_view,
    normalize_license,
    segmentation_from_legacy_annotation_list,
)


def get_instance(
    instance_id: str,
    *,
    query_params: Optional[Dict[str, Any]] = None,
    annotation: bool = True,
    content: Any = True,
) -> Any:
    _ = query_params
    fetch_ann = annotation is not False
    fetch_body = content is not False
    try:
        meta = fetch_edition_metadata(instance_id)
        text_content = ""
        if fetch_body:
            text_content = fetch_edition_content(instance_id)
        ann_bundle: Dict[str, Any] = {}
        if fetch_ann:
            ann_bundle = fetch_edition_annotation(edition_id=instance_id, type="segmentations")
        return build_legacy_instance_view(meta, text_content, ann_bundle)
    except HTTPException:
        raise
    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=504,
            detail="Request to OpenPecha API timed out after 30 seconds",
        )
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error connecting to OpenPecha API: {str(e)}",
        )


def _patch_edition_content_replace_all(edition_id: str, new_text: str, *, timeout: int = 120) -> None:
    current = fetch_edition_content(edition_id, timeout=timeout)
    if not isinstance(current, str):
        current = str(current)
    n = len(current)
    if n == 0:
        op: Dict[str, Any] = {"type": "insert", "position": 0, "text": new_text or " "}
    else:
        op = {"type": "replace", "start": 0, "end": n, "text": new_text}
    headers = json_headers()
    r = requests.patch(
        openpecha_url("editions", edition_id, "content"),
        json=op,
        headers=headers,
        timeout=timeout,
    )
    if r.status_code not in (200, 204):
        raise HTTPException(status_code=r.status_code, detail=r.text)


def update_instance(instance_id: str, payload: Dict[str, Any]) -> Any:
    try:
        _patch_edition_content_replace_all(instance_id, payload.get("content") or "")
        bib = bibliographic_request_from_legacy(payload.get("biblography_annotation"))
        ann: Dict[str, Any] = {}
        if bib:
            ann["bibliographic_metadata"] = bib
        seg = segmentation_from_legacy_annotation_list(payload.get("annotation") or [])
        if seg:
            ann["segmentation"] = seg
        if ann:
            _post_edition_annotations(instance_id, ann)
        return get_instance(instance_id)
    except HTTPException:
        raise
    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=504,
            detail="Request to OpenPecha API timed out after 30 seconds",
        )
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error connecting to OpenPecha API: {str(e)}",
        )


def _child_text_body(
    *,
    parent_text_id: str,
    category_id: str,
    language: str,
    title: str,
    license_str: str,
    contributions: List[Dict[str, Any]],
    link_field: str,
) -> Dict[str, Any]:
    title_loc = {language: title} if title else {language: "untitled"}
    body: Dict[str, Any] = {
        "title": title_loc,
        "language": language,
        "category_id": category_id,
        "contributions": contributions,
        "license": normalize_license(license_str),
        link_field: parent_text_id,
    }
    return body


def _create_linked_text_and_edition(
    *,
    source_edition_id: str,
    payload: Dict[str, Any],
    link_field: str,
    timeout: int = 30,
) -> Dict[str, Any]:
    meta = fetch_edition_metadata(source_edition_id, timeout=timeout)
    parent_text_id = meta.get("text_id")
    if not parent_text_id:
        raise HTTPException(status_code=502, detail="Source edition has no text_id")
    parent = get_text(parent_text_id)
    category_id = payload.get("category_id") or parent.get("category_id")
    if not category_id:
        raise HTTPException(
            status_code=400,
            detail="category_id is required (set on commentary payload or parent text must have category_id)",
        )
    default_role = "translator" if link_field == "translation_of" else "author"
    contribs: List[Dict[str, Any]] = []
    author = payload.get("author")
    if isinstance(author, dict) and author.get("person_id"):
        contribs.append({"person_id": author["person_id"], "role": default_role})
    elif isinstance(author, dict) and author.get("person_bdrc_id"):
        contribs.append({"person_bdrc_id": author["person_bdrc_id"], "role": default_role})
    if not contribs:
        contribs.append({"role": default_role})
    text_body = _child_text_body(
        parent_text_id=parent_text_id,
        category_id=category_id,
        language=payload.get("language", "en"),
        title=payload.get("title") or "",
        license_str=payload.get("license"),
        contributions=contribs,
        link_field=link_field,
    )
    headers = json_headers()
    tr = requests.post(
        openpecha_url("texts"),
        json=text_body,
        headers=headers,
        timeout=timeout,
    )
    if tr.status_code != 201:
        raise HTTPException(status_code=tr.status_code, detail=tr.text)
    new_text_id = tr.json().get("id")
    if not new_text_id:
        raise HTTPException(status_code=502, detail="OpenPecha v2 did not return new text id")

    seg = segmentation_from_legacy_annotation_list(payload.get("segmentation") or [])
    edition_body: Dict[str, Any] = {
        "metadata": {
            "type": "diplomatic",
            "source": source_edition_id,
        },
        "content": payload.get("content") or "",
    }
    if seg:
        edition_body["segmentation"] = seg
    er = requests.post(
        openpecha_url("texts", new_text_id, "editions"),
        json=edition_body,
        headers=headers,
        timeout=timeout,
    )
    if er.status_code != 201:
        raise HTTPException(status_code=er.status_code, detail=er.text)
    new_edition_id = er.json().get("id")
    if not new_edition_id:
        raise HTTPException(status_code=502, detail="OpenPecha v2 did not return new edition id")

    align = alignment_request_from_legacy_segments(
        payload.get("target_annotation"),
        payload.get("alignment_annotation"),
        source_edition_id,
    )
    if align:
        _post_edition_annotations(new_edition_id, {"alignment": align})

    bib = bibliographic_request_from_legacy(payload.get("biblography_annotation"))
    if bib:
        _post_edition_annotations(new_edition_id, {"bibliographic_metadata": bib})

    return {
        "message": "Created successfully",
        "edition_id": new_edition_id,
        "text_id": new_text_id,
    }


def create_translation(instance_id: str, payload: Dict[str, Any], *, timeout: int = 30) -> Any:
    try:
        return _create_linked_text_and_edition(
            source_edition_id=instance_id,
            payload=payload,
            link_field="translation_of",
            timeout=timeout,
        )
    except HTTPException:
        raise
    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=504,
            detail="Request to OpenPecha API timed out after 30 seconds",
        )
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error connecting to OpenPecha API: {str(e)}",
        )


def create_commentary(instance_id: str, payload: Dict[str, Any], *, timeout: int = 30) -> Any:
    try:
        return _create_linked_text_and_edition(
            source_edition_id=instance_id,
            payload=payload,
            link_field="commentary_of",
            timeout=timeout,
        )
    except HTTPException:
        raise
    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=504,
            detail="Request to OpenPecha API timed out after 30 seconds",
        )
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error connecting to OpenPecha API: {str(e)}",
        )


def _related_edition_to_legacy(ed: Dict[str, Any], relationship: str = "related") -> Dict[str, Any]:
    text_id = ed.get("text_id") or ""
    t: Dict[str, Any] = {}
    if text_id:
        try:
            t = get_text(text_id)
        except HTTPException:
            t = {}
    return {
        "edition_id": ed.get("id"),
        "metadata": {
            "edition_type": ed.get("type", ""),
            "copyright": "",
            "text_id": text_id,
            "title": t.get("title") or {},
            "alt_titles": [],
            "language": t.get("language") or "",
            "contributions": t.get("contributions") or [],
        },
        "annotation": None,
        "relationship": relationship,
    }


def list_related_instances(
    instance_id: str,
    *,
    relationship_type: Optional[str] = None,
    timeout: Optional[int] = None,
) -> Any:
    del relationship_type
    kw: Dict[str, Any] = {"headers": openpecha_headers()}
    if timeout is not None:
        kw["timeout"] = timeout
    response = requests.get(
        openpecha_url("editions", instance_id, "related"),
        **kw,
    )
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    data = response.json()
    editions = data if isinstance(data, list) else []
    return [_related_edition_to_legacy(e) for e in editions if isinstance(e, dict)]
