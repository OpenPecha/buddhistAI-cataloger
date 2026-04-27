from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any


from cataloger.controller.openpecha_api.instances import (
    get_instance as openpecha_get_instance,
    openpecha_get_edition_alignments,
)
from cataloger.controller.openpecha_api.annotations import delete_annotation as openpecha_delete_annotation

router = APIRouter()


@router.delete("/alignment/{annotation_id}")
async def delete_alignment_annotation(annotation_id: str):
    """Delete an alignment annotation on OpenPecha by id."""
    return openpecha_delete_annotation("alignments", annotation_id)



class Span(BaseModel):
    start: int
    end: int


class PreparedDataResponse(BaseModel):
    source_text: str
    target_text: str
    has_alignment: bool
    annotation_id: Optional[str] = None
    annotation: Optional[Dict[str, Any]] = None


def apply_segmentation(text: str, segmentation_data: List[Dict[str, Any]]) -> str:
    """Apply segmentation to text by inserting newlines at segment boundaries"""
    if not segmentation_data or len(segmentation_data) == 0:
        return text
    
    # Sort annotations by span start position
    sorted_annotations = sorted(
        segmentation_data,
        key=lambda x: x.get("span", {}).get("start", 0)
    )
    
    # Extract each segment and join with newlines
    segments = []
    for annotation in sorted_annotations:
        span = annotation.get("span", {})
        if not span:
            continue
        start = span.get("start", 0)
        end = span.get("end", len(text))
        if start < len(text) and end <= len(text) and start < end:
            segments.append(text[start:end])
    
    return "\n".join(segments) if segments else text


def reconstruct_segments(
    target_annotation: List[Dict[str, Any]],
    alignment_annotation: List[Dict[str, Any]],
    source_text: str,
    target_text: str
) -> tuple[List[str], List[str]]:
    """Reconstruct segments from alignment annotations"""
    # Sort target annotations by index, fallback to span start if index missing
    sorted_target = sorted(
        target_annotation,
        key=lambda x: x.get("index", x.get("span", {}).get("start", 0))
    )
    
    # Sort alignment annotations by index, fallback to span start if index missing
    sorted_alignment = sorted(
        alignment_annotation,
        key=lambda x: x.get("index", x.get("span", {}).get("start", 0))
    )
    
    # Reconstruct source segments from alignment annotations
    source_segments = []
    for align_ann in sorted_alignment:
        span = align_ann.get("span", {})
        if not span:
            continue
        start = span.get("start", 0)
        end = span.get("end", len(source_text))
        if start < len(source_text) and end <= len(source_text) and start < end:
            source_segments.append(source_text[start:end])
    
    # Reconstruct target segments from target annotations
    target_segments = []
    for target_ann in sorted_target:
        span = target_ann.get("span", {})
        if not span:
            continue
        start = span.get("start", 0)
        end = span.get("end", len(target_text))
        if start < len(target_text) and end <= len(target_text) and start < end:
            target_segments.append(target_text[start:end])
    
    return source_segments, target_segments


def prepare_data(aligned_edition_id: str, root_edition_id: str) -> Dict[str, Any]:
    """Prepare data by fetching instances, checking related instances first for alignment,
    then falling back to segmentation annotations if no alignment exists"""
    try:
        aligned_instance = openpecha_get_instance(
            edition_id=aligned_edition_id
        )
    except HTTPException as e:
        raise HTTPException(
            status_code=e.status_code,
            detail=f"Error fetching source instance: {e.detail}",
        ) from e

    try:
        root_instance = openpecha_get_instance(
            edition_id=root_edition_id
        )
    except HTTPException as e:
        raise HTTPException(
            status_code=e.status_code,
            detail=f"Error fetching target instance: {e.detail}",
        ) from e
    root_text = root_instance.get("content", "")
    aligned_text = aligned_instance.get("content", "")
    try:         
        alignments_annotations=  openpecha_get_edition_alignments(edition_id=aligned_edition_id)

    except HTTPException:
        alignments_annotations = None
   
   
   


    return {
        "source_text": aligned_text,
        "target_text": root_text,
        "has_alignment": alignments_annotations is not None,
        "annotation": alignments_annotations,
    }


@router.get("/{aligned_edition_id}/{root_edition_id}")
async def get_alignment(
    aligned_edition_id: str,
    root_edition_id: str
) :
  
    try:
        # Prepare data (fetch instances, annotations, etc.)
        prepared_data = prepare_data(aligned_edition_id, root_edition_id)
        
      
        return prepared_data
    
    except HTTPException:   
        raise HTTPException(
            status_code=500,
            detail=f"Error preparing alignment data: {str(e)}"
        )

