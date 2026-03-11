import os
from typing import Any, Dict, Optional

import httpx
from dotenv import load_dotenv

from bdrc.volume import get_http_client

load_dotenv(override=True)

BDRC_BACKEND_URL = os.getenv("BDRC_BACKEND_URL")
APPLICATION_JSON = "application/json"
TIMEOUT_ERROR_MSG = "Request to BDRC OTAPI timed out"


if BDRC_BACKEND_URL is None:
    raise ValueError("BDRC_BACKEND_URL is not set")

async def search_works(
    title: Optional[str] = None,
    author_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Search works via BDRC OTAPI.

    GET /works/search?title=...&author_name=...
    """
    url = f"{BDRC_BACKEND_URL}/works/search"
    params: Dict[str, str] = {}
    if title is not None:
        params["title"] = title
    if author_name is not None:
        params["author_name"] = author_name

    headers = {"accept": APPLICATION_JSON}

    try:
        client = await get_http_client()
        response = await client.get(url, params=params or None, headers=headers)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as e:
        error_msg = f"HTTP error {e.response.status_code}: {e.response.text}"
        raise RuntimeError(error_msg) from e
    except httpx.TimeoutException as e:
        raise TimeoutError(TIMEOUT_ERROR_MSG) from e
    except httpx.RequestError as e:
        raise ConnectionError(f"Error connecting to BDRC OTAPI: {str(e)}") from e


async def search_persons(
    author_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Search persons via BDRC OTAPI.

    GET /persons/search?author_name=...
    """
    url = f"{BDRC_BACKEND_URL}/persons/search"
    params: Dict[str, str] = {}
    if author_name is not None:
        params["author_name"] = author_name

    headers = {"accept": APPLICATION_JSON}

    try:
        client = await get_http_client()
        response = await client.get(url, params=params or None, headers=headers)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as e:
        error_msg = f"HTTP error {e.response.status_code}: {e.response.text}"
        raise RuntimeError(error_msg) from e
    except httpx.TimeoutException as e:
        raise TimeoutError(TIMEOUT_ERROR_MSG) from e
    except httpx.RequestError as e:
        raise ConnectionError(f"Error connecting to BDRC OTAPI: {str(e)}") from e
