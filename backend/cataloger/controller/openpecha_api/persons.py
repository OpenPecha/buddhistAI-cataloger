from typing import Any, Dict, Optional

import requests
from fastapi import HTTPException

from cataloger.controller.openpecha_api.base import openpecha_headers, openpecha_url


def _map_create_person(payload: Dict[str, Any]) -> Dict[str, Any]:
    name = payload.get("name") or {}
    if isinstance(name, dict):
        name = {k: v for k, v in name.items() if v}
    alt_names = []
    for a in payload.get("alt_names") or []:
        if isinstance(a, dict):
            loc = {k: v for k, v in a.items() if v}
            if loc:
                alt_names.append(loc)
    out: Dict[str, Any] = {"name": name}
    if alt_names:
        out["alt_names"] = alt_names
    if payload.get("bdrc"):
        out["bdrc"] = payload["bdrc"]
    if payload.get("wiki"):
        out["wiki"] = payload["wiki"]
    return out


def list_persons(
    *,
    limit: int = 100,
    offset: int = 0,
    name: Optional[str] = None,
    bdrc: Optional[str] = None,
    wiki: Optional[str] = None,
) -> Any:
    params: Dict[str, Any] = {
        "limit": min(limit, 100),
        "offset": offset,
        "name": name,
        "bdrc": bdrc,
        "wiki": wiki,
    }
    params = {k: v for k, v in params.items() if v is not None}
    response = requests.get(
        openpecha_url("persons"),
        params=params,
        headers=openpecha_headers(),
    )
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()


def get_person(person_id: str) -> Any:
    response = requests.get(
        openpecha_url("persons", person_id),
        headers=openpecha_headers(),
    )
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()


def create_person(payload: Dict[str, Any]) -> Any:
    body = _map_create_person(payload)
    response = requests.post(
        openpecha_url("persons"),
        json=body,
        headers={**openpecha_headers(), "Content-Type": "application/json"},
    )
    if response.status_code != 201:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    data = response.json()
    pid = data.get("id")
    return {"message": "Person created successfully", "_id": pid, "id": pid}
