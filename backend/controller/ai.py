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
from models.outliner import OutlinerDocument, OutlinerSegment
from prompts.ai_prompts import get_title_author_prompt, get_text_boundary_detection_prompt

load_dotenv(override=True)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")


def detect_text_boundaries_rule_based(content: str) -> Optional[List[int]]:
    """
    Rule-based detection of text boundaries using regex patterns.
    Returns list of starting positions if patterns are found, None otherwise.
    
    Args:
        content: The text content to analyze
        
    Returns:
        List of starting positions or None if no patterns found
    """
    # Define split markers matching the frontend patterns
    split_markers = [
        # Tibetan markers
        {'pattern': '༄༅༅། །', 'type': 'string'},
        {'pattern': '༄༅༅', 'type': 'string'},
        {'pattern': r'༄༅༅[།\s]*', 'type': 'regex'},
        
        # Common chapter/section markers
        {'pattern': r'\n\s*第[一二三四五六七八九十百千万]+[章节卷篇回]\s*', 'type': 'regex'},
        {'pattern': r'\n\s*Chapter\s+\d+\s*[:-]?\s*', 'type': 'regex', 'flags': re.IGNORECASE},
        {'pattern': r'\n\s*Section\s+\d+\s*[:-]?\s*', 'type': 'regex', 'flags': re.IGNORECASE},
        
        # Sanskrit/Tibetan text boundaries
        {'pattern': r'\n\s*[ༀ-༿]+\s*\n', 'type': 'regex'},
    ]
    
    all_positions = set()
    
    # Check each marker pattern and collect all matching positions
    for marker in split_markers:
        positions = []
        
        if marker['type'] == 'string':
            # Exact string match
            pattern_str = marker['pattern']
            search_index = 0
            while True:
                index = content.find(pattern_str, search_index)
                if index == -1:
                    break
                positions.append(index)
                search_index = index + 1
        else:
            # Regex match
            flags = marker.get('flags', 0)
            pattern = re.compile(marker['pattern'], flags)
            for match in pattern.finditer(content):
                positions.append(match.start())
        
        # Add all found positions
        all_positions.update(positions)
    
    # If we found any patterns, return the starting positions
    if all_positions:
        # Convert to sorted list and ensure 0 is included
        starting_positions = sorted(set(all_positions))
        if not starting_positions or starting_positions[0] != 0:
            starting_positions.insert(0, 0)
        
        # Remove duplicates and ensure we don't exceed text length
        starting_positions = sorted(set(starting_positions))
        text_length = len(content)
        starting_positions = [pos for pos in starting_positions if pos <= text_length]
        
        return starting_positions
    
    return None


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
            model="gemini-2.5-flash-lite",
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
            model="gemini-2.5-flash-lite",
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
    document.update_progress()
    
    # Commit all changes
    db.commit()
    
    return len(db_segments)


def detect_text_endings(content: str, document_id: str, db: Session) -> tuple[List[int], int]:
    """
    Detect text endings using rule-based or AI detection and create segments.
    
    Args:
        content: The text content to analyze
        document_id: The document ID to associate segments with
        db: Database session
        
    Returns:
        Tuple of (starting_positions, total_segments)
        
    Raises:
        HTTPException: If detection fails
    """
    try:
        # First, try rule-based detection
        rule_based_positions = detect_text_boundaries_rule_based(content)
        
        if rule_based_positions:
            starting_positions = rule_based_positions
        else:
            # If no rule-based patterns found, proceed with AI detection
            starting_positions = detect_text_endings_ai(content)
        
        if not starting_positions:
            raise HTTPException(
                status_code=500,
                detail="Could not detect any text segments"
            )
        
        # Create segments in database
        total_segments = create_segments_from_positions(
            db=db,
            content=content,
            document_id=document_id,
            starting_positions=starting_positions
        )
        
        return starting_positions, total_segments
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error detecting text endings: {str(e)}"
        )
