import os
from typing import Any, Dict, List, Optional

import httpx
from dotenv import load_dotenv
from pydantic import BaseModel

from bdrc.volume import get_http_client

load_dotenv(override=True)

BDRC_BACKEND_URL = os.getenv("BDRC_BACKEND_URL")
APPLICATION_JSON = "application/json"
TIMEOUT_ERROR_MSG = "Request to BDRC OTAPI timed out"

if BDRC_BACKEND_URL is None:
    raise ValueError("BDRC_BACKEND_URL is not set")


class CreateWorkBody(BaseModel):
    """Request body for OTAPI POST /api/v1/works."""

    pref_label_bo: Optional[str] = None
    alt_label_bo: Optional[List[str]] = None
    authors: Optional[List[str]] = None
    versions: Optional[List[str]] = None
    modified_by: Optional[str] = None


async def create_work(
    pref_label_bo: Optional[str] = None,
    alt_label_bo: Optional[List[str]] = None,
    authors: Optional[List[str]] = None,
    versions: Optional[List[str]] = None,
    modified_by: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create a work via BDRC OTAPI.

    POST /api/v1/works
    """
    url = f"{BDRC_BACKEND_URL}/works"
    payload: Dict[str, Any] = {}
    if pref_label_bo is not None:
        payload["pref_label_bo"] = pref_label_bo
    if alt_label_bo is not None:
        payload["alt_label_bo"] = alt_label_bo
    if authors is not None:
        payload["authors"] = authors
    if versions is not None:
        payload["versions"] = versions
    if modified_by is not None:
        payload["modified_by"] = modified_by

    headers = {"accept": APPLICATION_JSON, "Content-Type": APPLICATION_JSON}

    try:
        client = await get_http_client()
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as e:
        error_msg = f"HTTP error {e.response.status_code}: {e.response.text}"
        raise RuntimeError(error_msg) from e
    except httpx.TimeoutException as e:
        raise TimeoutError(TIMEOUT_ERROR_MSG) from e
    except httpx.RequestError as e:
        raise ConnectionError(f"Error connecting to BDRC OTAPI: {str(e)}") from e


async def update_work(
    work_id: str,
    pref_label_bo: Optional[str] = None,
    alt_label_bo: Optional[List[str]] = None,
    authors: Optional[List[str]] = None,
    versions: Optional[List[str]] = None,
    modified_by: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Update a work via BDRC OTAPI.

    PUT /api/v1/works/{work_id}
    """
    url = f"{BDRC_BACKEND_URL}/works/{work_id}"
    payload: Dict[str, Any] = {}
    if pref_label_bo is not None:
        payload["pref_label_bo"] = pref_label_bo
    if alt_label_bo is not None:
        payload["alt_label_bo"] = alt_label_bo
    if authors is not None:
        payload["authors"] = authors
    if versions is not None:
        payload["versions"] = versions
    if modified_by is not None:
        payload["modified_by"] = modified_by

    headers = {"accept": APPLICATION_JSON, "Content-Type": APPLICATION_JSON}

    try:
        client = await get_http_client()
        response = await client.put(url, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as e:
        error_msg = f"HTTP error {e.response.status_code}: {e.response.text}"
        raise RuntimeError(error_msg) from e
    except httpx.TimeoutException as e:
        raise TimeoutError(TIMEOUT_ERROR_MSG) from e
    except httpx.RequestError as e:
        raise ConnectionError(f"Error connecting to BDRC OTAPI: {str(e)}") from e


async def find_matching_work(
    text_bo: str,
    volume_id: str,
    cstart: int,
    cend: int,
) -> Dict[str, Any]:
    """
    Find a matching work via BDRC OTAPI matching endpoint.

    POST /api/v1/matching/find-work
    """
    url = f"{BDRC_BACKEND_URL}/matching/find-work"
    payload = {
        "text_bo": text_bo,
        "volume_id": volume_id,
        "cstart": cstart,
        "cend": cend,
    }
    headers = {"accept": APPLICATION_JSON, "Content-Type": APPLICATION_JSON}
    try:
        client = await get_http_client()
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as e:
        error_msg = f"HTTP error {e.response.status_code}: {e.response.text}"
        raise RuntimeError(error_msg) from e
    except httpx.TimeoutException as e:
        raise TimeoutError(TIMEOUT_ERROR_MSG) from e
    except httpx.RequestError as e:
        raise ConnectionError(f"Error connecting to BDRC OTAPI: {str(e)}") from e


async def get_work(work_id: str) -> Dict[str, Any]:
    """
    Get a work from BDRC OTAPI by work id.
    """
    url = f"{BDRC_BACKEND_URL}/works/{work_id}"
    headers = {"accept": APPLICATION_JSON}
    try:
        client = await get_http_client()
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as e:
        error_msg = f"HTTP error {e.response.status_code}: {e.response.text}"
        raise RuntimeError(error_msg) from e
    except httpx.TimeoutException as e:
        raise TimeoutError(TIMEOUT_ERROR_MSG) from e
    except httpx.RequestError as e:
        raise ConnectionError(f"Error connecting to BDRC OTAPI: {str(e)}") from e

