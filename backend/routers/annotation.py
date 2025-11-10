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


class Annotation(BaseModel):
    id: str
    span: Span


class AlignmentAnnotation(BaseModel):
    id: str
    span: Span
    index: int
    alignment_index: List[int]


class TargetAnnotation(BaseModel):
    id: str
    span: Span
    index: int


class AnnotationResponse(BaseModel):
    annotation: Optional[List[Annotation]]
    alignment_annotation: Optional[List[AlignmentAnnotation]]
    target_annotation: Optional[List[TargetAnnotation]]


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
