"""
AI router for text analysis and detection endpoints.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from sqlalchemy.orm import Session
from core.database import get_db
from controller.ai import generate_title_author, detect_text_endings

router = APIRouter()


class TextEndingDetectionRequest(BaseModel):
    content: str = Field(..., description="The text content to analyze for text endings")
    document_id: str = Field(..., description="The document ID to associate segments with")


class ContentRequest(BaseModel):
    content: str = Field(..., description="The text content to analyze for title and author")


class TitleAuthorResponse(BaseModel):
    title: Optional[str] = Field(None, description="Extracted title from the content if explicitly mentioned")
    suggested_title: Optional[str] = Field(None, description="Suggested title if not found in content, in the same language as the content")
    author: Optional[str] = Field(None, description="Extracted author name from the content if explicitly mentioned")
    suggested_author: Optional[str] = Field(None, description="Suggested author name if not found in content, in the same language as the content")


class TextEndingDetectionResponse(BaseModel):
    starting_positions: List[int] = Field(..., description="List of character positions where each text segment starts (after detected endings)")
    total_segments: int = Field(..., description="Total number of detected text segments")


@router.post("/generate-title-author", response_model=TitleAuthorResponse)
async def generate_title_author_route(request: ContentRequest):
    """
    Generate or extract title and author from text content.
    
    Analyzes the beginning and end of the content to extract or suggest
    title and author information in the same language as the content.
    """
    result = generate_title_author(request.content, TitleAuthorResponse)
    return TitleAuthorResponse(**result)


@router.post("/detect-text-endings", response_model=TextEndingDetectionResponse)
async def detect_text_endings_route(
    request: TextEndingDetectionRequest,
    db: Session = Depends(get_db)
):
    """
    Detect text endings (sentence/paragraph boundaries) and return starting positions of each segment.
    
    First checks rule-based patterns, then uses Gemini AI if no patterns are found.
    Creates segments in the database when detection is complete.
    """
    starting_positions, total_segments = detect_text_endings(
        content=request.content,
        document_id=request.document_id,
        db=db
    )
    
    return TextEndingDetectionResponse(
        starting_positions=starting_positions,
        total_segments=total_segments
    )
