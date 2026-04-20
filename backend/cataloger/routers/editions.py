from typing import Any, Dict, List

from fastapi import APIRouter
from pydantic import BaseModel, Field

from cataloger.controller.openpecha_api.instances import (
    get_edition_segmentations as openpecha_get_edition_segmentations,
    get_instance as openpecha_get_instance,
    post_edition_segmentations as openpecha_post_edition_segmentations,
    update_instance as openpecha_update_instance,
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
