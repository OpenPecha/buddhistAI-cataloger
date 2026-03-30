"""
AI router for text analysis and detection endpoints.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
from sqlalchemy.orm import Session
from core.database import get_db
from outliner.models.outliner import OutlinerDocument
from cataloger.controller.ai import (
    generate_title_author,
    segment_and_create_from_parent,
    parse_toc_from_text,
)

router = APIRouter()


class TextEndingDetectionRequest(BaseModel):
    content: str = Field(..., description="The text content to analyze for text endings")
    segment_id: str = Field(..., description="The segment ID to associate segments with")


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


class ParseTocResponse(BaseModel):
    is_toc: bool = Field(..., description="Whether the text is recognized as a table of contents")
    entries: List[str] = Field(default_factory=list, description="TOC lines/items when is_toc is true")


class ParseTocRequest(BaseModel):
    content: str = Field(..., description="Text to analyze as a possible table of contents")
    document_id: Optional[str] = Field(
        None,
        description="If set, persist entries on this outliner document (clear when not a TOC)",
    )


class SegmentCreationResponse(BaseModel):
    message: str = Field(..., description="Success message")
    segments_created: int = Field(..., description="Number of segments created")
    segment_ids: List[str] = Field(..., description="List of created segment IDs")


@router.post("/parse-toc", response_model=ParseTocResponse)
async def parse_toc_route(request: ParseTocRequest, db: Session = Depends(get_db)):
    """
    Check if the given text is a table of contents; if so, return the list of TOC entries.
    When document_id is provided, stores entries on the outliner document (or clears them if not a TOC).
    """
    result = parse_toc_from_text(request.content, ParseTocResponse)
    if isinstance(result, ParseTocResponse):
        parsed = result
    else:
        parsed = ParseTocResponse(**result)

    if request.document_id:
        document = (
            db.query(OutlinerDocument)
            .filter(OutlinerDocument.id == request.document_id)
            .first()
        )
        if document:
            if parsed.is_toc and parsed.entries:
                document.ai_toc_entries = list(parsed.entries)
            else:
                document.ai_toc_entries = None
            document.updated_at = datetime.utcnow()
            db.commit()

    return parsed


@router.post("/generate-title-author", response_model=TitleAuthorResponse)
async def generate_title_author_route(request: ContentRequest):
    """
    Generate or extract title and author from text content.
    
    Analyzes the beginning and end of the content to extract or suggest
    title and author information in the same language as the content.
    """
    result = generate_title_author(request.content, TitleAuthorResponse)
    # Handle both dict and TitleAuthorResponse instance returns
    if isinstance(result, TitleAuthorResponse):
        return result
    return TitleAuthorResponse(**result)


@router.post("/detect-text-endings", response_model=SegmentCreationResponse)
async def detect_text_endings_route(
    request: TextEndingDetectionRequest,
    db: Session = Depends(get_db)
):
    """
    Detect text endings and create segments from a parent segment.
    
    Requires segment_id. Extracts content from the segment's span, performs segmentation
    (rule-based first, then Gemini AI if needed), validates boundaries, and creates
    child segments in the database.
    
    Returns success response with created segment IDs.
    """
    try:
        segments_created, segment_ids = segment_and_create_from_parent(
            db=db,
            segment_id=request.segment_id,
            content=request.content
        )
        
        return SegmentCreationResponse(
            message="Segments created successfully",
            segments_created=segments_created,
            segment_ids=segment_ids
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error creating segments: {str(e)}"
        )
