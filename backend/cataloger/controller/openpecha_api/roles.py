from typing import Any

import requests
from fastapi import HTTPException

from cataloger.controller.openpecha_api.base import (
    openpecha_headers,
    openpecha_url,
)


def get_roles() -> Any:
    url = openpecha_url("roles")
    headers = openpecha_headers()
    try:
        response = requests.get(url, headers=headers, timeout=30)
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return response.json()
    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=504,
            detail="Request to roles API timed out after 30 seconds",
        )
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=502,
            detail=f"Error connecting to roles API: {str(e)}",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
