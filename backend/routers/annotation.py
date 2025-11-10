from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import requests
import os
from dotenv import load_dotenv

load_dotenv(override=True)

router = APIRouter()

API_ENDPOINT = os.getenv("OPENPECHA_ENDPOINT")


class Span(BaseModel):
    start: int
    end: int


class AnnotationData(BaseModel):
    id: str
    span: Span
    reference: Optional[str] = None


class AnnotationResponse(BaseModel):
    id: str
    type: str
    data: List[AnnotationData]


@router.get("/{annotation_id}", response_model=AnnotationResponse)
async def get_annotation(annotation_id: str):
    """Get annotation by ID"""
    response = requests.get(f"{API_ENDPOINT}/annotations/{annotation_id}")
    try:

        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return response.json()
