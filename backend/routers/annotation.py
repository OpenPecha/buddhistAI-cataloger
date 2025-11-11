from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Union
import requests
import os
from dotenv import load_dotenv

load_dotenv(override=True)

router = APIRouter()

API_ENDPOINT = os.getenv("OPENPECHA_ENDPOINT")


class Span(BaseModel):
    start: int
    end: int


class AlignmentAnnotationItem(BaseModel):
    id: str
    span: Span
    index: int
    alignment_index: List[int]


class TargetAnnotationItem(BaseModel):
    id: str
    span: Span
    index: int


class SegmentationAnnotationItem(BaseModel):
    id: str
    span: Span
    reference: Optional[str] = None


class AlignmentAnnotationData(BaseModel):
    alignment_annotation: List[AlignmentAnnotationItem]
    target_annotation: List[TargetAnnotationItem]


class AnnotationResponse(BaseModel):
    id: str
    type: str
    data: Union[AlignmentAnnotationData, List[SegmentationAnnotationItem]]


@router.get("/{annotation_id}")
async def get_annotation(annotation_id: str):
    """Get annotation by ID"""
    response = requests.get(f"{API_ENDPOINT}/annotations/{annotation_id}")
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()
