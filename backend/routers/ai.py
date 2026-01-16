import os
from google import genai
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
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