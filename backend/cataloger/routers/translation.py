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
from cataloger.controller.openpecha_api.texts import (
    list_instances_for_text as openpecha_list_instances_for_text,
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
    instance_id: str
    text_id: str



class InstanceListItem(BaseModel):
    id: str
    type: str
    source: Optional[str] = None
    bdrc: Optional[str] = None
    wiki: Optional[str] = None
    colophon: Optional[str] = None
    incipit_title: Optional[Dict[str, str]] = None
    alt_incipit_titles: List[Dict[str, str]] = []


class Contribution(BaseModel):
    person_id: str
    person_name: Optional[str] = None
    role: str


class RelatedInstanceMetadata(BaseModel):
    instance_type: str
    copyright: str
    text_id: str
    title: Dict[str, str]
    alt_titles: List[Dict[str, str]] = []
    language: str
    contributions: List[Contribution] = []


class RelatedInstance(BaseModel):
    instance_id: str
    metadata: RelatedInstanceMetadata
    annotation: Optional[str] = None
    relationship: str


@router.get("/{text_id}/instances")
async def get_text_instances(text_id: str):
    """Get all instances for a specific text"""
    return openpecha_list_instances_for_text(text_id)



@router.post("/{instance_id}/translation", status_code=201)
async def create_translation(instance_id: str, translation: CreateTranslation):
    """Create a translation for a specific instance"""
    payload = translation.model_dump(exclude_none=True)
    payload.pop("user", None)
    return openpecha_create_translation(instance_id, payload)


@router.post("/{instance_id}/commentary", status_code=201)
async def create_commentary(instance_id: str, commentary: CreateCommentary):
    """Create a commentary for a specific instance"""
    payload = commentary.model_dump(exclude_none=True)
    payload.pop("user", None)
    return openpecha_create_commentary(instance_id, payload)


@router.get("/{instance_id}/related")
async def get_related_instances(instance_id: str, type: Optional[str] = None):
    """Get all instances related to a specific instance

    Args:
        instance_id: The ID of the instance to get related instances for
        type: Optional filter by relationship type (root, commentary, translation)
    """
    return openpecha_list_related_instances(instance_id, relationship_type=type)


