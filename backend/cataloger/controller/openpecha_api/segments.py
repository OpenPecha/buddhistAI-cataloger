from typing import Any

import requests
from fastapi import HTTPException

from cataloger.controller.openpecha_api.base import json_headers, openpecha_url


def update_segment_content(segment_id: str, content: str, *, timeout: int = 30) -> Any:
    """v2 OpenAPI documents GET only; try PATCH for compatibility with cataloger UX."""
    url = openpecha_url("segments", segment_id, "content")
    try:
        response = requests.patch(
            url,
            headers=json_headers(),
            json={"content": content},
            timeout=timeout,
        )
        if response.status_code in (200, 204):
            return response.json() if response.content else {"ok": True}
        response = requests.put(
            url,
            headers=json_headers(),
            json={"content": content},
            timeout=timeout,
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return response.json() if response.content else {"ok": True}
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
