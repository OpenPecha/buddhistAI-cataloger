from fastapi import APIRouter
from pydantic import BaseModel

from cataloger.controller.openpecha_api.segments import (
    update_segment_content as openpecha_update_segment_content,
)

router = APIRouter()


class UpdateSegmentContentRequest(BaseModel):
    content: str


@router.put("/{segment_id}/content")
async def update_segment_content(segment_id: str, request: UpdateSegmentContentRequest):
    """Update segment content by segment ID"""
    return openpecha_update_segment_content(segment_id, request.content)
