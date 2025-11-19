from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import requests
import os
from dotenv import load_dotenv

load_dotenv(override=True)

router = APIRouter()

API_ENDPOINT = os.getenv("OPENPECHA_ENDPOINT")


@router.get("")
async def get_enum(
    type: str = Query(..., description="Enum type (e.g., 'language', 'role')")
):
    """
    Get enum values by type.
    
    - **type**: The type of enum to retrieve (e.g., "language", "role")
    """
    if not API_ENDPOINT:
        raise HTTPException(
            status_code=500,
            detail="OPENPECHA_ENDPOINT environment variable is not set"
        )
    
    try:
        params = {"type": type}
        url = f"{API_ENDPOINT}/enum"
        response = requests.get(url, params=params, timeout=30)
        
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        
        return response.json()
        
    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=504,
            detail="Request to OpenPecha API timed out after 30 seconds"
        )
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=502,
            detail=f"Error connecting to OpenPecha API: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

