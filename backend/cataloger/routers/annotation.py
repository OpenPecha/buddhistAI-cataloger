from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Union, Literal
from fast_antx.core import transfer

from cataloger.controller.openpecha_api.annotations import (
    create_annotation_for_instance as openpecha_create_annotation_for_instance,
    get_annotation as openpecha_get_annotation,
    update_annotation_body as openpecha_update_annotation_body,
)

router = APIRouter()


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


class CreateTableOfContentsAnnotationItem(BaseModel):
    title: str
    segments: List[str]


class CreateTableOfContentsAnnotation(BaseModel):
    type: Literal["table_of_contents"]
    annotation: List[CreateTableOfContentsAnnotationItem]

class CleanAnnotationRequest(BaseModel):
    text: str
    sample_text: str

CreateAnnotation = Union[CreateAlignmentAnnotation, CreateSegmentationAnnotation, CreateTableOfContentsAnnotation]


class AnnotationResponse(BaseModel):
    id: str
    type: str
    data: Union[AlignmentAnnotationData, List[SegmentationAnnotationItem], None] = None






@router.get("/{annotation_id}")
async def get_annotation(annotation_id: str):
    """Get annotation by ID"""
    return openpecha_get_annotation(annotation_id)




@router.put("/{annotation_id}/annotation")
async def update_annotation(annotation_id: str, annotation: UpdateAnnotation):
    """Update an annotation by ID"""
    return openpecha_update_annotation_body(annotation_id, annotation.dict())

@router.post("/{edition_id}/annotation")
async def create_annotation(edition_id: str, annotation: CreateAnnotation):
    """Create an annotation on a specific edition."""
    return openpecha_create_annotation_for_instance(edition_id, annotation.dict())



@router.post("/clean-annotation",  status_code=201)
async def clean_annotation(request: CleanAnnotationRequest):
    text_content = request.text.replace("\n", "")
    try:
        return generate_clean_annotation(text_content, request.sample_text)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating clean annotation: {str(e)}",
        )


def generate_clean_annotation(base_text: str, sample_text: str):
    #  function takes text, samplet text
    #  use the annotation from sample text to generate the annotation for the new text
    #  return the annoation list
    patterns = [
        ["newlines", r"(\n)"],  # Transfer newlines from sample_text to text
    ]
    annotated_text = transfer(sample_text, patterns, base_text, "txt")
    return annotated_text
