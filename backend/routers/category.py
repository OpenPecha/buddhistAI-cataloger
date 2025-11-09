from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
import requests
import os
from dotenv import load_dotenv

load_dotenv(override=True)

router = APIRouter()

API_ENDPOINT = os.getenv("OPENPECHA_ENDPOINT")


class Category(BaseModel):
    id: str
    parent: Optional[str] = None
    title: str
    has_child: bool


@router.get("", response_model=List[Category])
async def get_categories(
    application: Optional[str] = Query(None, description="Application filter (e.g., webuddhist)"),
    language: Optional[str] = Query(None, description="Language filter (e.g., bo, en)"),
    parent_id: Optional[str] = Query(None, description="Parent category ID for subcategories")
):
    """
    Get categories with optional filters for application, language, and parent category.
    
    - **application**: Filter by application (e.g., "webuddhist")
    - **language**: Filter by language (e.g., "bo" for Tibetan, "en" for English)
    - **parent_id**: Get subcategories of a specific parent category
    """
    if not API_ENDPOINT:
        raise HTTPException(
            status_code=500,
            detail="OPENPECHA_ENDPOINT environment variable is not set"
        )
    
    try:
        # Build query parameters
        params = {}
        if application:
            params["application"] = application
        if language:
            params["language"] = language
        if parent_id:
            params["parent_id"] = parent_id
        
        url = f"{API_ENDPOINT}/categories"
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

