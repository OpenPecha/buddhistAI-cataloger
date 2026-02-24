import httpx
import os
from typing import Literal, Optional, Dict, Any, List
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv(override=True)

BDRC_BACKEND_URL = os.getenv("BDRC_BACKEND_URL", "")
APPLICATION_JSON = "application/json"
TIMEOUT_ERROR_MSG = "Request to BDRC API timed out"

STATUS = Literal["new", "in_progress", "review", "completed"]
# Pydantic models for volume update
class SegmentInput(BaseModel):
    id: Optional[str] = None
    cstart: int
    cend: int
    segment_type: str
    parent_segment: Optional[str] = None
    title_bo: Optional[str] = None
    author_name_bo: Optional[str] = None


class VolumeInput(BaseModel):
    i_version: Optional[str] = None
    etext_source: Optional[str] = None
    volume_number: Optional[int] = None
    status: STATUS = "new"
    pages: Optional[List[Dict[str, Any]]] = None
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
    work_id: str,
    instance_id: str
) -> Dict[str, Any]:
    """
    Fetch a specific volume from BDRC API by work ID and instance ID
    
    Args:
        work_id: The work ID (e.g., "W00CHZ0103344")
        instance_id: The instance ID (e.g., "I1CZ39")
    
    Returns:
        Dictionary containing volume details
    """
    url = f"{BDRC_BACKEND_URL}/volumes/{work_id}/{instance_id}"
    
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
    work_id: str,
    instance_id: str,
    volume_data: VolumeInput
) -> Dict[str, Any]:
    """
    Update a specific volume in BDRC API by work ID and instance ID
    
    Args:
        work_id: The work ID (e.g., "W00CHZ0103344")
        instance_id: The instance ID (e.g., "I1CZ39")
        volume_data: VolumeInput object containing the update data
    
    Returns:
        Dictionary containing updated volume details
    """
    url = f"{BDRC_BACKEND_URL}/volumes/{work_id}/{instance_id}"
    
    headers = {
        "accept": APPLICATION_JSON,
        "Content-Type": APPLICATION_JSON
    }
    
    # Convert Pydantic model to dict, excluding None values for optional fields
    payload = volume_data.model_dump(exclude_none=True)
    
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
        raise ConnectionError(f"Error connecting to BDRC API: {str(e)}") from e
