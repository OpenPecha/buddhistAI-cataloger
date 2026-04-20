from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import os
from dotenv import load_dotenv

from cataloger.controller.openpecha_api.instances import (
    create_commentary as openpecha_create_commentary,
    create_translation as openpecha_create_translation,
    list_related_instances as openpecha_list_related_instances,
)
load_dotenv(override=True)

router = APIRouter()

TRANSLATION_BACKEND_URL = os.getenv("TRANSLATION_BACKEND_URL")


class Span(BaseModel):
    start: int
    end: int


class Author(BaseModel):
    person_id: Optional[str] = None
    person_bdrc_id: Optional[str] = None


class Segmentation(BaseModel):
    span: Span


class TargetAnnotation(BaseModel):
    span: Span
    index: int


class AlignmentAnnotation(BaseModel):
    span: Span
    index: int
    alignment_index: List[int]


class BibliographyAnnotation(BaseModel):
    span: Span
    type: str


class CreateTranslation(BaseModel):
    language: str
    content: str
    title: str
    source: str
    alt_titles: Optional[List[str]] = None
    author: Optional[Author] = None
    segmentation: List[Segmentation]
    target_annotation: Optional[List[TargetAnnotation]] = None
    alignment_annotation: Optional[List[AlignmentAnnotation]] = None
    copyright: str
    license: str
    biblography_annotation: Optional[List[BibliographyAnnotation]] = None
    user: Optional[str] = None


class CreateCommentary(BaseModel):
    language: str
    content: str
    title: str
    source: str
    alt_titles: Optional[List[str]] = None
    author: Optional[Author] = None
    segmentation: List[Segmentation]
    target_annotation: Optional[List[TargetAnnotation]] = None
    alignment_annotation: Optional[List[AlignmentAnnotation]] = None
    copyright: str
    license: str
    bdrc: Optional[str] = None
    category_id: Optional[str] = None
    biblography_annotation: Optional[List[BibliographyAnnotation]] = None
    user: Optional[str] = None


class TranslationResponse(BaseModel):
    message: str
    edition_id: str
    text_id: str



class Contribution(BaseModel):
    person_id: str
    person_name: Optional[str] = None
    role: str


class RelatedEditionMetadata(BaseModel):
    edition_type: str
    copyright: str
    text_id: str
    title: Dict[str, str]
    alt_titles: List[Dict[str, str]] = []
    language: str
    contributions: List[Contribution] = []


class RelatedEdition(BaseModel):
    edition_id: str
    metadata: RelatedEditionMetadata
    annotation: Optional[str] = None
    relationship: str


@router.post("/{edition_id}/translation", status_code=201)
async def create_translation(edition_id: str, translation: CreateTranslation):
    """Create a translation from a source edition."""
    payload = translation.model_dump(exclude_none=True)
    payload.pop("user", None)
    return openpecha_create_translation(edition_id, payload)


@router.post("/{edition_id}/commentary", status_code=201)
async def create_commentary(edition_id: str, commentary: CreateCommentary):
    """Create a commentary from a source edition."""
    payload = commentary.model_dump(exclude_none=True)
    payload.pop("user", None)
    return openpecha_create_commentary(edition_id, payload)


@router.get("/{edition_id}/related")
async def get_related_editions(edition_id: str, type: Optional[str] = None):
    """Editions related to the given edition (same text family).

    Args:
        edition_id: Source edition id
        type: Optional filter by relationship type (root, commentary, translation)
    """
    return openpecha_list_related_instances(edition_id, relationship_type=type)


