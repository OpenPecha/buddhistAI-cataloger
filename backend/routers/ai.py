import os
from google import genai
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
from dotenv import load_dotenv

load_dotenv(override=True)

router = APIRouter()

# Configure Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

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
{request.content}

Provide all four fields (title, suggested_title, author, suggested_author) in the same language as the content."""

        # Generate content with structured output using Pydantic schema
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": TitleAuthorResponse,
            }
        )
        print(response)
        
        # Access the parsed response directly
        if hasattr(response, 'parsed') and response.parsed:
            return response.parsed
        elif hasattr(response, 'text') and response.text:
            # Fallback: parse JSON manually if parsed attribute not available
            import json
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

@router.post("/detect-text-endings", response_model=TextEndingDetectionResponse)
async def detect_text_endings(request: ContentRequest):
    """
    Detect text endings (sentence/paragraph boundaries) and return starting positions of each segment.
    Uses Gemini to intelligently identify natural text boundaries.
    """
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY environment variable is not set"
        )
    
    try:
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
            model="gemini-2.5-flash",
            contents=prompt,
            config={
                "response_mime_type": "application/json",
            }
        )
        
        # Parse the response and calculate starting positions
        import json
        import re
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
                
                return TextEndingDetectionResponse(
                    starting_positions=starting_positions,
                    total_segments=len(starting_positions)
                )
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
                    
                    return TextEndingDetectionResponse(
                        starting_positions=starting_positions,
                        total_segments=len(starting_positions)
                    )
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
            
    except Exception as e:
        # Re-raise HTTPException as-is, wrap other exceptions
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"Error detecting text endings: {str(e)}")