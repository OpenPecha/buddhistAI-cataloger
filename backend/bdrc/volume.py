import httpx
import os
from typing import Literal, Optional, Dict, Any, List
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv(override=True)

BDRC_BACKEND_URL = os.getenv("BDRC_BACKEND_URL", "")
APPLICATION_JSON = "application/json"
TIMEOUT_ERROR_MSG = "Request to BDRC API timed out"

STATUS = Literal["active", "in_progress","in_review", "reviewed"]
# Pydantic models for volume update
class SegmentInput(BaseModel):
    cstart: int
    cend: int
    title_bo: Optional[str] = None
    author_name_bo: Optional[str] = None
    mw_id: Optional[str] = None
    wa_id: Optional[str] = None
    part_type: Optional[Literal["text", "editorial"]] = None


class VolumeInput(BaseModel):
    rep_id: Optional[str] = None
    vol_id: Optional[str] = None
    vol_version: Optional[str] = None
    status: STATUS
    base_text: Optional[str] = None
    segments: Optional[List[SegmentInput]] = None

# Async HTTP client with connection pooling (reused across requests)
_http_client: Optional[httpx.AsyncClient] = None


async def get_http_client() -> httpx.AsyncClient:
    """Get or create shared async HTTP client with connection pooling"""
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(10.0),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=100),
            follow_redirects=True
        )
    return _http_client


async def get_volumes(
    status: str = "new",
    offset: int = 0,
    limit: int = 50
) -> Dict[str, Any]:
    """
    Fetch volumes from BDRC API
    
    Args:
        status: Filter volumes by status (default: "new")
        offset: Pagination offset (default: 0)
        limit: Maximum number of results to return (default: 50)
    
    Returns:
        Dictionary containing total, offset, limit, and items list
    """
    url = f"{BDRC_BACKEND_URL}/volumes"
    
    params = {
        "status": status,
        "offset": offset,
        "limit": limit
    }
    
    headers = {
        "accept": APPLICATION_JSON
    }
    
    try:
        client = await get_http_client()
        response = await client.get(url, params=params, headers=headers)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as e:
        error_msg = f"HTTP error {e.response.status_code}: {e.response.text}"
        raise RuntimeError(error_msg) from e
    except httpx.TimeoutException as e:
        raise TimeoutError(TIMEOUT_ERROR_MSG) from e
    except httpx.RequestError as e:
        raise ConnectionError(f"Error connecting to BDRC API: {str(e)}") from e


async def get_volume(
    volume_id: str
) -> Dict[str, Any]:
    """
    Fetch a specific volume from BDRC API by work ID and instance ID
    
    Args:
        work_id: The work ID (e.g., "W00CHZ0103344")
        volume_id: The volume ID (e.g., "V1CZ39")
    
    Returns:
        Dictionary containing volume details
    """
    url = f"{BDRC_BACKEND_URL}/volumes/{volume_id}"
    
    headers = {
        "accept": APPLICATION_JSON
    }
    
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
        raise ConnectionError(f"Error connecting to BDRC API: {str(e)}") from e


async def update_volume(
    volume_id: str,
    volume_data: VolumeInput
) -> Dict[str, Any]:
    """
    Update a specific volume in BDRC API by volume ID
    
    Args:
        volume_id: The volume ID (e.g., "V1CZ39")
        volume_data: VolumeInput object containing the update data
    
    Returns:
        Dictionary containing updated volume details
    """
    url = f"{BDRC_BACKEND_URL}/volumes/{volume_id}"
    
    headers = {
        "accept": APPLICATION_JSON,
        "Content-Type": APPLICATION_JSON
    }
    
    # Convert Pydantic model to dict, excluding None values for optional fields
    payload = volume_data.model_dump(exclude_none=True)
    
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
        raise ConnectionError(f"Error connecting to BDRC API: {str(e)}") from e


async def update_volume_status(
    volume_id: str,
    status: STATUS
) -> Dict[str, Any]:
    """
    Update the status of a specific volume in BDRC API by volume ID
    """
    url = f"{BDRC_BACKEND_URL}/volumes/{volume_id}/status"
    print(f"updating volume status to {status} for volume {volume_id}")
    headers = {
        "accept": APPLICATION_JSON
    }
    params = {
        "new_status": status
    }
    try:
        client = await get_http_client()
        response = await client.patch(url, params=params, headers=headers)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as e:
        error_msg = f"HTTP error {e.response.status_code}: {e.response.text}"
        raise RuntimeError(error_msg) from e
    except httpx.TimeoutException as e:
        raise TimeoutError(TIMEOUT_ERROR_MSG) from e
    except httpx.RequestError as e:
        raise ConnectionError(f"Error connecting to BDRC API: {str(e)}") from e