from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from cataloger.controller.openpecha_api.instances import (
    get_edition_segmentations as openpecha_get_edition_segmentations,
    get_instance as openpecha_get_instance,
    list_related_instances,
    openpecha_get_edition_alignments,
    openpecha_post_edition_alignments,
    post_edition_segmentations as openpecha_post_edition_segmentations,
    update_instance as openpecha_update_instance,
    update_instance_content as openpecha_update_instance_content,
)
from cataloger.routers.text import UpdateEdition

router = APIRouter()


class SegmentationLineSpan(BaseModel):
    start: int
    end: int


class SegmentationSegmentBlock(BaseModel):
    lines: List[SegmentationLineSpan]


class EditionSegmentationsBody(BaseModel):
    segments: List[SegmentationSegmentBlock]
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AlignedSegmentBlock(BaseModel):
    lines: List[SegmentationLineSpan]
    alignment_indices: List[int]


class EditionAlignmentsBody(BaseModel):
    target_id: str
    target_segments: List[SegmentationSegmentBlock]
    aligned_segments: List[AlignedSegmentBlock]
    metadata: Dict[str, Any] = Field(default_factory=dict)


class UpdateEditionContentBody(BaseModel):
    content: str
    start: int
    end: int


@router.put("/{edition_id}", status_code=200)
async def update_edition(edition_id: str, edition: UpdateEdition):
    payload = edition.model_dump(exclude_none=True)
    return openpecha_update_instance(edition_id, payload)


@router.get("/{edition_id}")
async def get_edition(edition_id: str, annotation: bool = True):
    return openpecha_get_instance(edition_id, annotation=annotation, content=True)

@router.get("/{edition_id}/segmentations")
async def list_edition_segmentations(edition_id: str):
    return openpecha_get_edition_segmentations(edition_id)


@router.post("/{edition_id}/segmentations", status_code=201)
async def create_edition_segmentations(
    edition_id: str,
    body: EditionSegmentationsBody,
):
    return openpecha_post_edition_segmentations(
        edition_id,
        body.model_dump(exclude_none=True),
    )
    
@router.get("/{edition_id}/alignments")
async def get_edition_alignments(edition_id):
    return openpecha_get_edition_alignments(edition_id)    


@router.post("/{edition_id}/alignments", status_code=201)
async def create_edition_alignments(
    edition_id: str,
    body: EditionAlignmentsBody,
):
    return openpecha_post_edition_alignments(
        edition_id,
        body.model_dump(exclude_none=True),
    )


@router.get("/{edition_id}/related")
async def get_related_editions(edition_id: str, type: Optional[str] = None):
    """Editions related to the given edition (same text family).

    Args:
        edition_id: Source edition id
        type: Optional filter by relationship type (root, commentary, translation)
    """
    return list_related_instances(edition_id)


@router.put("/{edition_id}/content", status_code=200)
async def update_edition_content(
    edition_id: str,
    body: UpdateEditionContentBody,
):
    return openpecha_update_instance_content(
        edition_id, body.content, body.start, body.end
    )