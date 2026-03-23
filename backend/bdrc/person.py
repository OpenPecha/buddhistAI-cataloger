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


class CreatePersonBody(BaseModel):
    """Request body for OTAPI POST /api/v1/persons."""
    pref_label_bo: Optional[str] = None
    alt_label_bo: Optional[List[str]] = None
    dates: Optional[str] = None
    modified_by: Optional[str] = None


async def create_person(
    pref_label_bo: Optional[str] = None,
    alt_label_bo: Optional[List[str]] = None,
    dates: Optional[str] = None,
    modified_by: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create a person via BDRC OTAPI.

    POST /api/v1/persons
    """
    url = f"{BDRC_BACKEND_URL}/persons"
    payload: Dict[str, Any] = {}
    if pref_label_bo is not None:
        payload["pref_label_bo"] = pref_label_bo
    if alt_label_bo is not None:
        payload["alt_label_bo"] = alt_label_bo
    if dates is not None:
        payload["dates"] = dates
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


async def merge_persons(
    person_id: str,
    target_person_id: str,
    modified_by: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Merge a person into a target person using BDRC OTAPI.
    POST /api/v1/persons/{person_id}/merge
    """
    url = f"{BDRC_BACKEND_URL}/persons/{person_id}/merge"
    payload = {
        "canonical_id": target_person_id,
        "modified_by": modified_by or "string",
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