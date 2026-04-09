from typing import Any, Dict, List, Optional

import requests
from fastapi import HTTPException

from cataloger.controller.openpecha_api.base import (
    json_headers,
    openpecha_headers,
    openpecha_url,
)
from cataloger.controller.openpecha_api.v2_adapters import (
    create_text_payload_from_legacy,
    edition_metadata_from_legacy,
    edition_output_to_instance_list_item,
    patch_text_payload_from_legacy,
    segmentation_from_legacy_annotation_list,
    text_output_to_legacy,
    wrap_text_list,
    bibliographic_request_from_legacy,
)


def list_texts(
    *,
    limit: int = 30,
    offset: int = 0,
    language: Optional[str] = None,
    author: Optional[str] = None,
    text_type: Optional[str] = None,
    title: Optional[str] = None,
    category_id: Optional[str] = None,
    x_application: Optional[str] = None,
) -> Any:
    params: Dict[str, Any] = {
        "limit": min(limit, 100),
        "offset": offset,
        "language": language,
        "author_id": author,
        "title": title,
        "category_id": category_id,
    }
    params = {k: v for k, v in params.items() if v is not None}
    headers = openpecha_headers(x_application=x_application)
    try:
        response = requests.get(openpecha_url("texts"), params=params, headers=headers, timeout=60)
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        raw = response.json()
        wrapped = wrap_text_list(raw, limit=limit, offset=offset)
        if text_type and isinstance(wrapped.get("results"), list):
            wrapped["results"] = [r for r in wrapped["results"] if r.get("type") == text_type]
            wrapped["count"] = len(wrapped["results"])
        return wrapped
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


def create_text(payload: Dict[str, Any], *, x_application: Optional[str] = None) -> Any:
    try:
        body = create_text_payload_from_legacy(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    headers = json_headers(x_application=x_application)
    try:
        response = requests.post(
            openpecha_url("texts"),
            json=body,
            headers=headers,
            timeout=60,
        )
        if response.status_code != 201:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        data = response.json()
        eid = data.get("id")
        return {"message": "Text created successfully", "id": eid}
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


def get_text(text_id: str, *, x_application: Optional[str] = None) -> Any:
    headers = openpecha_headers(x_application=x_application)
    try:
        response = requests.get(
            openpecha_url("texts", text_id),
            headers=headers,
            timeout=60,
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return text_output_to_legacy(response.json())
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


def update_text(text_id: str, payload: Dict[str, Any], *, x_application: Optional[str] = None) -> Any:
    body = patch_text_payload_from_legacy(payload)
    if not body:
        return get_text(text_id, x_application=x_application)
    headers = json_headers(x_application=x_application)
    try:
        response = requests.patch(
            openpecha_url("texts", text_id),
            json=body,
            headers=headers,
            timeout=60,
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return text_output_to_legacy(response.json())
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


def list_instances_for_text(text_id: str) -> Any:
    headers = openpecha_headers()
    try:
        response = requests.get(
            openpecha_url("texts", text_id, "editions"),
            headers=headers,
            timeout=60,
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        data = response.json()
        editions = data if isinstance(data, list) else []
        return [edition_output_to_instance_list_item(e) for e in editions if isinstance(e, dict)]
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


def _post_edition_annotations(edition_id: str, ann: Dict[str, Any]) -> None:
    if not ann:
        return
    headers = json_headers()
    r = requests.post(
        openpecha_url("editions", edition_id, "annotations"),
        json=ann,
        headers=headers,
        timeout=120,
    )
    if r.status_code not in (200, 201):
        raise HTTPException(status_code=r.status_code, detail=r.text)


def create_instance_for_text(text_id: str, payload: Dict[str, Any], *, timeout: int = 120) -> Any:
    metadata = edition_metadata_from_legacy(payload.get("metadata") or {})
    seg = segmentation_from_legacy_annotation_list(payload.get("annotation") or [])
    body: Dict[str, Any] = {
        "metadata": metadata,
        "content": payload.get("content") or "",
    }
    if seg:
        body["segmentation"] = seg
    headers = json_headers()
    try:
        response = requests.post(
            openpecha_url("texts", text_id, "editions"),
            json=body,
            headers=headers,
            timeout=timeout,
        )
        if response.status_code != 201:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        data = response.json()
        edition_id = data.get("id")
        if not edition_id:
            raise HTTPException(status_code=502, detail="OpenPecha v2 did not return edition id")

        bib = bibliographic_request_from_legacy(payload.get("biblography_annotation"))
        ann_post: Dict[str, Any] = {}
        if bib:
            ann_post["bibliographic_metadata"] = bib
        if ann_post:
            _post_edition_annotations(edition_id, ann_post)

        return {"message": "Instance created successfully", "id": edition_id}
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


def fetch_edition_metadata(edition_id: str, *, timeout: Optional[int] = None) -> Dict[str, Any]:
    kw: Dict[str, Any] = {"headers": openpecha_headers()}
    if timeout is not None:
        kw["timeout"] = timeout
    r = requests.get(openpecha_url("editions", edition_id, "metadata"), **kw)
    if r.status_code != 200:
        raise HTTPException(status_code=r.status_code, detail=r.text)
    return r.json()


def fetch_edition_content(edition_id: str, *, timeout: Optional[int] = None) -> str:
    kw: Dict[str, Any] = {"headers": openpecha_headers()}
    if timeout is not None:
        kw["timeout"] = timeout
    r = requests.get(openpecha_url("editions", edition_id, "content"), **kw)
    if r.status_code != 200:
        raise HTTPException(status_code=r.status_code, detail=r.text)
    # v2 returns raw JSON string
    try:
        return r.json()
    except Exception:
        return r.text


def fetch_edition_annotations(
    edition_id: str,
    *,
    types: Optional[List[str]] = None,
    timeout: Optional[int] = None,
) -> Dict[str, Any]:
    params = {}
    if types:
        params["type"] = types
    kw: Dict[str, Any] = {"headers": openpecha_headers(), "params": params}
    if timeout is not None:
        kw["timeout"] = timeout
    r = requests.get(openpecha_url("editions", edition_id, "annotations"), **kw)
    if r.status_code != 200:
        raise HTTPException(status_code=r.status_code, detail=r.text)
    return r.json()
