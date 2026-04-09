from typing import Any

import requests
from fastapi import HTTPException

from cataloger.controller.openpecha_api.base import (
    openpecha_headers,
    openpecha_url,
    require_openpecha_base_url,
)


def get_enum(enum_type: str, *, timeout: int = 30) -> Any:
    if enum_type == "language":
        try:
            response = requests.get(
                openpecha_url("languages"),
                headers=openpecha_headers(),
                timeout=timeout,
            )
            if response.status_code != 200:
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

    base = require_openpecha_base_url()
    try:
        params = {"type": enum_type}
        response = requests.get(f"{base}/enum", params=params, timeout=timeout)
        if response.status_code != 200:
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
