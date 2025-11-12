from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Union, Literal
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


class UpdateAlignmentAnnotationItem(BaseModel):
    span: Span
    index: int
    alignment_index: List[int]


class UpdateTargetAnnotationItem(BaseModel):
    span: Span
    index: int


class UpdateAlignmentAnnotationData(BaseModel):
    alignment_annotation: List[UpdateAlignmentAnnotationItem]
    target_annotation: List[UpdateTargetAnnotationItem]


class UpdateSegmentationAnnotationItem(BaseModel):
    span: Span


class UpdateSegmentationAnnotationData(BaseModel):
    annotations: List[UpdateSegmentationAnnotationItem]


class UpdateAnnotation(BaseModel):
    type: str
    data: Union[UpdateAlignmentAnnotationData, UpdateSegmentationAnnotationData]


# Models for POST (create annotation)
class CreateAlignmentTargetAnnotationItem(BaseModel):
    span: Span
    index: int


class CreateAlignmentAnnotationItem(BaseModel):
    span: Span
    index: int
    alignment_index: List[int]


class CreateAlignmentAnnotation(BaseModel):
    type: Literal["alignment"]
    target_manifestation_id: str
    target_annotation: List[CreateAlignmentTargetAnnotationItem]
    alignment_annotation: List[CreateAlignmentAnnotationItem]


class CreateSegmentationAnnotationItem(BaseModel):
    span: Span


class CreateSegmentationAnnotation(BaseModel):
    type: Literal["segmentation"]
    annotation: List[CreateSegmentationAnnotationItem]


CreateAnnotation = Union[CreateAlignmentAnnotation, CreateSegmentationAnnotation]


class AnnotationResponse(BaseModel):
    id: str
    type: str
    data: Union[AlignmentAnnotationData, List[SegmentationAnnotationItem], None] = None


@router.get("/{annotation_id}")
async def get_annotation(annotation_id: str):
    """Get annotation by ID"""
    response = requests.get(f"{API_ENDPOINT}/annotations/{annotation_id}")
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()


@router.put("/{annotation_id}/annotation")
async def update_annotation(annotation_id: str, annotation: UpdateAnnotation):
    """Update an annotation by ID"""
    response = requests.put(
        f"{API_ENDPOINT}/annotations/{annotation_id}/annotation", 
        json=annotation.dict()
    )
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()

@router.post("/{instance_id}/annotation")
async def create_annotation(instance_id: str, annotation: CreateAnnotation):
    """Create an annotation for a specific instance"""
    response = requests.post(
        f"{API_ENDPOINT}/annotations/{instance_id}/annotation", 
        json=annotation.dict()
    )
    if response.status_code != 201:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()