from fastapi import APIRouter, Query, Body
from pydantic import BaseModel
from typing import List, Optional

from cataloger.controller.openpecha_api.categories import (
    create_category as openpecha_create_category,
    list_categories as openpecha_list_categories,
)

router = APIRouter()




@router.get("")
async def get_categories(
    application: Optional[str] = Query(None, description="Application filter (e.g., webuddhist)"),
    language: Optional[str] = Query(None, description="Language filter (e.g., bo, en)"),
    parent_id: Optional[str] = Query(None, description="Parent category ID for subcategories"),
):
    """
    Get categories with optional filters for application, language, and parent category.

    - **application**: Filter by application (e.g., "webuddhist")
    - **language**: Filter by language (e.g., "bo" for Tibetan, "en" for English)
    - **parent_id**: Get subcategories of a specific parent category
    """
    return openpecha_list_categories(
        application=application,
        language=language,
        parent_id=parent_id,
    )


@router.post("", tags=["categories"])
async def create_category(
    application: str = Body(..., embed=True, description="Application identifier"),
    title: dict = Body(
        ...,
        embed=True,
        description="Title in different languages, e.g. {'en': 'Literature', 'bo': 'རྩོམ་རིག', 'zh': ''}",
    ),
    parent: Optional[str] = Body(
        None,
        embed=True,
        description="Parent category ID, or null for root category",
    ),
):
    """
    Create a new category in the OpenPecha API.

    - **application**: Application identifier (e.g., "webuddhist")
    - **title**: Dictionary of translations for the category title (e.g., {"en": "Literature", "bo": "..."} )
    - **parent**: Optional. Parent category ID, or null for root category.
    """
    return openpecha_create_category(application=application, title=title, parent=parent)
