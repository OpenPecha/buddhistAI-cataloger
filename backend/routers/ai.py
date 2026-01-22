import os
import re
import uuid
import json
from google import genai
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func
from dotenv import load_dotenv
from core.database import get_db
from models.outliner import OutlinerDocument, OutlinerSegment

load_dotenv(override=True)

router = APIRouter()

# Configure Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

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
async def generate_title_author(request: ContentRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY environment variable is not set"
        )
    content = request.content
    start_clip = content[:400]
    end_clip = content[-400:] if len(content) > 400 else ""
    clipped_content = f"{start_clip}\n{end_clip}" if end_clip else start_clip
    try:
        # Initialize the client
        client = genai.Client(api_key=GEMINI_API_KEY)
        
        # Create prompt to extract or suggest title and author from context
        prompt = f"""Analyze the following text and provide both extracted and suggested values for title and author.
IMPORTANT: All responses (title, suggested_title, author, suggested_author) must be in the SAME LANGUAGE as the content itself.

Instructions:
1. Detect the language of the content
2. Extract title and author if they are explicitly mentioned in the text (keep them in their original language)
3. If title is not found, suggest an appropriate title based on the content's theme, subject matter, and context (in the same language as the content)
4. If author is not found, suggest an author name if there are clues (signatures, colophons, style indicators, etc.), otherwise use null (in the same language as the content)

Fields to provide:
- title: The extracted title if explicitly mentioned, otherwise null
- suggested_title: A suggested title if title is null, otherwise null (must be in the same language as content)
- author: The extracted author name if explicitly mentioned, otherwise null
- suggested_author: A suggested author name if author is null, otherwise null (must be in the same language as content)

Text to analyze:
{clipped_content}

Provide all four fields (title, suggested_title, author, suggested_author) in the same language as the content."""

        # Generate content with structured output using Pydantic schema
        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": TitleAuthorResponse,
            }
        )
        
        # Access the parsed response directly
        if hasattr(response, 'parsed') and response.parsed:
            return response.parsed
        elif hasattr(response, 'text') and response.text:
            # Fallback: parse JSON manually if parsed attribute not available
            result = json.loads(response.text.strip())
            return TitleAuthorResponse(
                title=result.get("title"),
                suggested_title=result.get("suggested_title"),
                author=result.get("author"),
                suggested_author=result.get("suggested_author")
            )
        else:
            raise HTTPException(
                status_code=500,
                detail="No response received from the model"
            )
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating title and author: {str(e)}")

def detect_text_boundaries_rule_based(content: str) -> Optional[List[int]]:
    """
    Rule-based detection of text boundaries using regex patterns.
    Returns list of starting positions if patterns are found, None otherwise.
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

@router.post("/detect-text-endings", response_model=TextEndingDetectionResponse)
async def detect_text_endings(request: TextEndingDetectionRequest, db: Session = Depends(get_db)):
    """
    Detect text endings (sentence/paragraph boundaries) and return starting positions of each segment.
    First checks rule-based patterns, then uses Gemini if no patterns are found.
    Creates segments in the database when detection is complete.
    """
    try:
        # Verify document exists
        document = db.query(OutlinerDocument).filter(OutlinerDocument.id == request.document_id).first()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # First, try rule-based detection
        rule_based_positions = detect_text_boundaries_rule_based(request.content)
        
        starting_positions = None
        if rule_based_positions:
            starting_positions = rule_based_positions
        else:
            # If no rule-based patterns found, proceed with AI detection
            if not GEMINI_API_KEY:
                raise HTTPException(
                    status_code=500,
                    detail="GEMINI_API_KEY environment variable is not set"
                )
        
            # Initialize the client
            client = genai.Client(api_key=GEMINI_API_KEY)
            
            # Create prompt to detect text endings and identify starting positions
            # We'll ask for ending positions and calculate starting positions ourselves for accuracy
            prompt = f"""You are an expert scholar of Tibetan texts with deep experience in textual criticism, canon structure, and discourse analysis.

You are given a SINGLE continuous block of text.
This text MAY contain multiple DISTINCT Tibetan texts concatenated together.

IMPORTANT:  
Your task is NOT to segment sentences or paragraphs.

Your task is ONLY to identify boundaries where a COMPLETELY DIFFERENT TEXT begins.
- most of the text normally start with "༄༅༅། །"
A new text boundary should be marked ONLY if there is a clear and strong CONTEXTUAL SHIFT, such as:
- Change of genre (e.g., prayer → commentary, verse → prose)
- Change of speaker or authorial voice
- Change of purpose (e.g., invocation → philosophical exposition)
- Change of doctrinal scope or topic that indicates a new standalone text
- Change in register that clearly signals a separate composition

DO NOT mark boundaries for:
- Sentence endings
- Paragraph breaks
- Line breaks
- Punctuation
- Minor topic shifts within the same text
- Structural markers that still belong to the same work

RULES FOR OUTPUT:
1. Return ONLY starting character positions (0-indexed) where a NEW text begins
2. Always include 0 as the first starting position
3. Only include additional positions if you are confident a DIFFERENT TEXT starts there
4. Be conservative — if unsure, DO NOT add a boundary
5. Count characters precisely, including spaces and newlines

TEXT:
{request.content}

OUTPUT FORMAT (JSON ONLY):
{{
  "starting_positions": [0, 456, 1823]
}}

If the entire content is a single coherent text, return:
{{
  "starting_positions": [0]
}}
"""

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
                    text_length = len(request.content)
                    starting_positions = [pos for pos in starting_positions if pos <= text_length]
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
                        text_length = len(request.content)
                        starting_positions = [pos for pos in starting_positions if pos <= text_length]
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
        
        # If we have starting positions (from either rule-based or AI detection), create segments
        if starting_positions:
            # Extract text segments and create database records
            db_segments = []
            text_length = len(request.content)
            for idx, start_pos in enumerate(starting_positions):
                end_pos = (
                    starting_positions[idx + 1]
                    if idx + 1 < len(starting_positions)
                    else text_length
                )

                segment_text = request.content[start_pos:end_pos]

                db_segments.append({
                    "id": str(uuid.uuid4()),
                    "document_id": request.document_id,
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
                OutlinerSegment.document_id == request.document_id,
                OutlinerSegment.is_annotated == True
            ).scalar() or 0
            document.update_progress()
            
            # Commit all changes
            db.commit()
            
            return TextEndingDetectionResponse(
                starting_positions=starting_positions,
                total_segments=len(starting_positions)
            )
        else:
            raise HTTPException(
                status_code=500,
                detail="Could not detect any text segments"
            )
            
    except HTTPException:
        # Re-raise HTTPException as-is
        raise
    except Exception as e:
        # Wrap other exceptions
        raise HTTPException(
            status_code=500,
            detail=f"Error detecting text endings: {str(e)}"
        )
            