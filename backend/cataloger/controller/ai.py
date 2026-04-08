"""
AI controller for text analysis and detection operations.
"""
import os
import re
import json
import uuid
from typing import Optional, List, Dict, Any
from google import genai
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from dotenv import load_dotenv
from outliner.models.outliner import OutlinerDocument, OutlinerSegment
from cataloger.prompts.ai_prompts import (
    get_title_author_prompt,
    get_title_from_start_prompt,
    get_author_from_end_prompt,
    get_text_boundary_detection_prompt,
    get_toc_parse_prompt,
)
from outliner.controller.outliner import get_segment
from outliner.utils.outliner_utils import incremental_update_document_progress, get_document_with_cache

load_dotenv(override=True)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_API_MODEL = "gemini-2.5-flash"

def generate_title_author(content: str, response_schema: Any) -> Dict[str, Optional[str]]:
    """
    Generate title and author from content using Gemini AI.
    
    Args:
        content: The text content to analyze
        response_schema: Pydantic model schema for structured output
        
    Returns:
        Dictionary with title, suggested_title, author, suggested_author
        
    Raises:
        HTTPException: If API key is missing or generation fails
    """
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY environment variable is not set"
        )
    
    # Clip content to first and last 400 characters
    start_clip = content[:400]
    end_clip = content[-400:] if len(content) > 400 else ""
    clipped_content = f"{start_clip}\n{end_clip}" if end_clip else start_clip
    
    try:
        # Initialize the client
        client = genai.Client(api_key=GEMINI_API_KEY)
        
        # Get prompt from prompts module
        prompt = get_title_author_prompt(clipped_content)
        
        # Generate content with structured output using Pydantic schema
        response = client.models.generate_content(
            model=GEMINI_API_MODEL,
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": response_schema,
            }
        )
        
        # Access the parsed response directly
        if hasattr(response, 'parsed') and response.parsed:
            return response.parsed
        elif hasattr(response, 'text') and response.text:
            # Fallback: parse JSON manually if parsed attribute not available
            result = json.loads(response.text.strip())
            return {
                "title": result.get("title"),
                "suggested_title": result.get("suggested_title"),
                "author": result.get("author"),
                "suggested_author": result.get("suggested_author")
            }
        else:
            raise HTTPException(
                status_code=500,
                detail="No response received from the model"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating title and author: {str(e)}"
        )


_TITLE_START_MAX_CHARS = 2500
_AUTHOR_END_MAX_CHARS = 2500


def generate_title_from_start(content: str, response_schema: Any) -> Any:
    """
    Title only: model sees the opening of the segment (first ~2500 characters).
    """
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY environment variable is not set",
        )
    excerpt = content[:_TITLE_START_MAX_CHARS] if content else ""
    if not excerpt.strip():
        raise HTTPException(status_code=400, detail="Content is empty")

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        prompt = get_title_from_start_prompt(excerpt)
        response = client.models.generate_content(
            model=GEMINI_API_MODEL,
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": response_schema,
            },
        )
        if hasattr(response, "parsed") and response.parsed:
            return response.parsed
        if hasattr(response, "text") and response.text:
            result = json.loads(response.text.strip())
            return {
                "title": result.get("title"),
                "suggested_title": result.get("suggested_title"),
            }
        raise HTTPException(status_code=500, detail="No response received from the model")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating title: {str(e)}",
        )


def generate_author_from_end(content: str, response_schema: Any) -> Any:
    """
    Author only: model sees the closing of the segment (last ~2500 characters).
    """
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY environment variable is not set",
        )
    if not content or not content.strip():
        raise HTTPException(status_code=400, detail="Content is empty")
    excerpt = (
        content[-_AUTHOR_END_MAX_CHARS:]
        if len(content) > _AUTHOR_END_MAX_CHARS
        else content
    )

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        prompt = get_author_from_end_prompt(excerpt)
        response = client.models.generate_content(
            model=GEMINI_API_MODEL,
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": response_schema,
            },
        )
        if hasattr(response, "parsed") and response.parsed:
            return response.parsed
        if hasattr(response, "text") and response.text:
            result = json.loads(response.text.strip())
            return {
                "author": result.get("author"),
                "suggested_author": result.get("suggested_author"),
            }
        raise HTTPException(status_code=500, detail="No response received from the model")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating author: {str(e)}",
        )


def detect_text_endings_ai(content: str) -> List[int]:
    """
    Detect text endings using AI when rule-based detection fails.
    
    Args:
        content: The text content to analyze
        
    Returns:
        List of starting positions
        
    Raises:
        HTTPException: If API key is missing or detection fails
    """
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY environment variable is not set"
        )
    
    try:
        # Initialize the client
        client = genai.Client(api_key=GEMINI_API_KEY)
        
        # Get prompt from prompts module
        prompt = get_text_boundary_detection_prompt(content)
        
        # Generate content with structured output
        response = client.models.generate_content(
            model=GEMINI_API_MODEL,
            contents=prompt,
            config={
                "response_mime_type": "application/json",
            }
        )
        
        # Parse the response and calculate starting positions
        if hasattr(response, 'text') and response.text:
            try:
                # Try to parse as JSON object or array
                response_text = response.text.strip()
                result = json.loads(response_text)
                
                # Handle different response formats
                if isinstance(result, dict):
                    # Expected format: {"starting_positions": [0, 456, 1823]}
                    starting_positions = result.get("starting_positions", [])
                elif isinstance(result, list):
                    # Fallback: direct array of positions
                    starting_positions = result
                else:
                    raise ValueError("Unexpected response format")
                
                # Validate and process starting positions
                if not isinstance(starting_positions, list):
                    raise ValueError("starting_positions is not a list")
                
                # Convert to integers and sort
                starting_positions = sorted([int(pos) for pos in starting_positions if isinstance(pos, (int, str))])
                
                # Ensure 0 is included as the first position
                if not starting_positions or starting_positions[0] != 0:
                    starting_positions.insert(0, 0)
                
                # Remove duplicates and sort
                starting_positions = sorted(set(starting_positions))
                
                # Ensure we don't exceed text length
                text_length = len(content)
                starting_positions = [pos for pos in starting_positions if pos <= text_length]
                
                return starting_positions
                
            except ValueError as e:
                # Fallback: try to extract positions from text response using regex
                # Look for array-like patterns in the response
                array_match = re.search(r'\[[\d\s,]+\]', response.text)
                if array_match:
                    starting_positions = json.loads(array_match.group())
                    starting_positions = sorted([int(pos) for pos in starting_positions])
                    
                    # Ensure 0 is included
                    if not starting_positions or starting_positions[0] != 0:
                        starting_positions.insert(0, 0)
                    
                    # Remove duplicates and validate
                    starting_positions = sorted(set(starting_positions))
                    text_length = len(content)
                    starting_positions = [pos for pos in starting_positions if pos <= text_length]
                    
                    return starting_positions
                else:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Could not parse positions from response: {response.text}. Error: {str(e)}"
                    )
        else:
            raise HTTPException(
                status_code=500,
                detail="No response received from the model"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error detecting text endings: {str(e)}"
        )


def create_segments_from_positions(
    db: Session,
    content: str,
    document_id: str,
    starting_positions: List[int]
) -> int:
    """
    Create database segments from starting positions.
    
    Args:
        db: Database session
        content: The full text content
        document_id: The document ID to associate segments with
        starting_positions: List of starting character positions
        
    Returns:
        Number of segments created
        
    Raises:
        HTTPException: If document not found or creation fails
    """
    # Verify document exists
    document = db.query(OutlinerDocument).filter(OutlinerDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Extract text segments and create database records
    db_segments = []
    text_length = len(content)
    
    for idx, start_pos in enumerate(starting_positions):
        end_pos = (
            starting_positions[idx + 1]
            if idx + 1 < len(starting_positions)
            else text_length
        )

        segment_text = content[start_pos:end_pos]

        db_segments.append({
            "id": str(uuid.uuid4()),
            "document_id": document_id,
            "text": segment_text,
            "segment_index": idx,
            "span_start": start_pos,
            "span_end": end_pos,
            "status": "unchecked",
            "is_annotated": False,
        })
    
    db.bulk_insert_mappings(OutlinerSegment, db_segments)
    
    # Update document statistics
    document.total_segments = len(db_segments)
    document.annotated_segments = db.query(func.count(OutlinerSegment.id)).filter(
        OutlinerSegment.document_id == document_id,
        OutlinerSegment.is_annotated == True
    ).scalar() or 0
    
    # Commit all changes
    db.commit()
    
    return len(db_segments)
