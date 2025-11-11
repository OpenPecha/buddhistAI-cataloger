from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import requests
import os
from dotenv import load_dotenv

load_dotenv(override=True)

router = APIRouter()

API_ENDPOINT = os.getenv("OPENPECHA_ENDPOINT")


class Span(BaseModel):
    start: int
    end: int


class Author(BaseModel):
    person_id: str


class Segmentation(BaseModel):
    span: Span


class TargetAnnotation(BaseModel):
    span: Span
    index: int


class AlignmentAnnotation(BaseModel):
    span: Span
    index: int
    alignment_index: List[int]


class CreateTranslation(BaseModel):
    language: str
    content: str
    title: str
    author: Author
    segmentation: List[Segmentation]
    target_annotation: List[TargetAnnotation]
    alignment_annotation: List[AlignmentAnnotation]
    copyright: str


class TranslationResponse(BaseModel):
    message: str
    instance_id: str
    text_id: str


class InstanceListItem(BaseModel):
    id: str
    bdrc: Optional[str] = None
    wiki: Optional[str] = None
    type: str
    copyright: str
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
    annotation: str
    relationship: str


@router.get("/{text_id}/instances", response_model=List[InstanceListItem])
async def get_text_instances(text_id: str):
    """Get all instances for a specific text"""
    response = requests.get(f"{API_ENDPOINT}/texts/{text_id}/instances")
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()


@router.post("/{instance_id}/translation", response_model=TranslationResponse, status_code=201)
async def create_translation(instance_id: str, translation: CreateTranslation):
    """Create a translation for a specific instance"""
    response = requests.post(
        f"{API_ENDPOINT}/instances/{instance_id}/translation", 
        json=translation.dict()
    )
    if response.status_code != 201:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()


@router.get("/{instance_id}/related", response_model=List[RelatedInstance])
async def get_related_instances(instance_id: str, type: Optional[str] = None):
    """Get all instances related to a specific instance
    
    Args:
        instance_id: The ID of the instance to get related instances for
        type: Optional filter by relationship type (root, commentary, translation)
    """
    params = {}
    if type:
        params["type"] = type
    
    response = requests.get(f"{API_ENDPOINT}/instances/{instance_id}/related", params=params)
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()


