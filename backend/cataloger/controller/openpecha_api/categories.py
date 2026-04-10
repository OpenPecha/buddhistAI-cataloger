from typing import Any, Dict, Optional

import requests
from fastapi import HTTPException

from cataloger.controller.openpecha_api.base import json_headers, openpecha_headers, openpecha_url


def _category_v2_to_legacy_row(c: Dict[str, Any]) -> Dict[str, Any]:
    title_val = c.get("title")
    if isinstance(title_val, dict) and title_val:
        title_str = next(iter(title_val.values()), "")
    else:
        title_str = str(title_val or "")
    children = c.get("children") or []
    return {
        "id": c.get("id", ""),
        "parent": c.get("parent_id"),
        "title": title_str,
        "has_child": bool(children),
    }


def _require_application_header(application: Optional[str]) -> str:
    if not application:
        raise HTTPException(
            status_code=400,
            detail="OpenPecha v2 categories require `application` query/body or OPENPECHA_X_APPLICATION",
        )
    return application


def list_categories(
    *,
    application: Optional[str] = None,
    language: Optional[str] = None,
    parent_id: Optional[str] = None,
    timeout: int = 30,
) -> Any:
    del language
    headers = openpecha_headers(x_application=application)
    if "X-Application" not in headers:
        raise HTTPException(
            status_code=400,
            detail="OpenPecha v2 categories require `application` query param or OPENPECHA_X_APPLICATION",
        )
    params: Dict[str, str] = {}
    if parent_id:
        params["parent_id"] = parent_id
    try:
        response = requests.get(
            openpecha_url("categories"),
            params=params,
            headers=headers,
            timeout=timeout,
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        raw = response.json()
        return raw
    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=504,
            detail="Request to OpenPecha API timed out after 30 seconds",
        )
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=502,
            detail=f"Error connecting to OpenPecha API: {str(e)}",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


def create_category(
    *,
    application: str,
    title: dict,
    parent: Optional[str],
    timeout: int = 30,
) -> Any:
    headers = json_headers(x_application=_require_application_header(application))
    payload: Dict[str, Any] = {"title": title}
    if parent is not None:
        payload["parent_id"] = parent
    try:
        response = requests.post(
            openpecha_url("categories"),
            json=payload,
            headers=headers,
            timeout=timeout,
        )
        if response.status_code not in (200, 201):
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return response.json()
    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=504,
            detail="Request to OpenPecha API timed out after 30 seconds",
        )
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=502,
            detail=f"Error connecting to OpenPecha API: {str(e)}",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
