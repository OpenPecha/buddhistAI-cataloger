from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

from cataloger.controller.openpecha_api.annotations import (
    get_annotation as openpecha_get_annotation,
)
from cataloger.controller.openpecha_api.instances import (
    get_instance as openpecha_get_instance,
    list_related_instances as openpecha_list_related_instances,
    openpecha_get_edition_alignments,
)

router = APIRouter()



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

    has_alignment = False

    # Step 1: Check for related instance relationship first
    # Check if target is in source's related instances (or vice versa)
    try:
        alignments_annotations = openpecha_get_edition_alignments(
            edition_id=aligned_edition_id
        )
    except HTTPException:
        alignments_annotations = None
    alignments_annotation={}
    has_alignment = False
    # alignments_annotation could be a dict with key 'alignments' which is a list of dicts
    if alignments_annotations and len(alignments_annotations) > 0:
        for item in alignments_annotation:
            target_id = item.get("target_id")  # handle both possible keys
            if target_id == root_edition_id:
                has_alignment = True
                break
   


    return {
        "source_text": aligned_text,
        "target_text": root_text,
        "has_alignment": has_alignment,
        "annotation": alignments_annotation,
    }


@router.get("/{aligned_edition_id}/{root_edition_id}")
async def get_alignment(
    aligned_edition_id: str,
    root_edition_id: str
) -> PreparedDataResponse:
  
    try:
        # Prepare data (fetch instances, annotations, etc.)
        prepared_data = prepare_data(aligned_edition_id, root_edition_id)
        
        source_text = prepared_data["source_text"]
        target_text = prepared_data["target_text"]
        has_alignment = prepared_data["has_alignment"]
        annotation_id = prepared_data.get("annotation_id")
        annotation_data = prepared_data.get("annotation")
       
        return PreparedDataResponse(
            source_text=source_text,
            target_text=target_text,
            has_alignment=has_alignment,
            annotation_id=annotation_id,
            annotation=annotation_data
        )
    
    except HTTPException:   
        raise HTTPException(
            status_code=500,
            detail=f"Error preparing alignment data: {str(e)}"
        )

