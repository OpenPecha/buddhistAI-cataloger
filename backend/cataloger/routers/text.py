from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
import os
from dotenv import load_dotenv

from cataloger.controller.openpecha_api.instances import (
    get_instance as openpecha_get_instance,
    update_instance as openpecha_update_instance,
)
from cataloger.controller.openpecha_api.texts import (
    create_instance_for_text as openpecha_create_instance_for_text,
    create_text as openpecha_create_text,
    get_text as openpecha_get_text,
    list_instances_for_text as openpecha_list_instances_for_text,
    list_texts as openpecha_list_texts,
    update_text as openpecha_update_text,
)

load_dotenv(override=True)

router = APIRouter()

TRANSLATION_BACKEND_URL = os.getenv("TRANSLATION_BACKEND_URL")

class Contribution(BaseModel):
    person_id: Optional[str] = None
    person_bdrc_id: Optional[str] = None
    person_name: Optional[Dict[str, str]] = None
    ai_id: Optional[str] = None
    role: str

class Text(BaseModel):
    id: str
    type: str
    title: Dict[str, str] = Field(
        ...,
        example={"bo": "དཔེ་མཚོན་ཞིག", "en": "Example Text"},
        description="Title in multiple languages, keyed by language code"
    )
    language: str
    target: Optional[str] = None
    contributions: Optional[List[Contribution]] = None
    date: Optional[str] = None
    bdrc: Optional[str] = None
    wiki: Optional[str] = None
    category_id: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class TextResponse(BaseModel):
    results: List[Text]
    count: int

class CreateTextResponse(BaseModel):
    message: str
    id: str

class CreateText(BaseModel):
    type: str
    title: Dict[str, str] = Field(
        ...,
        example={"bo": "དཔེ་མཚོན་ཞིག", "en": "Example Text"},
        description="Title in multiple languages, keyed by language code"
    )
    language: str
    contributions:List[Contribution] = []
    target: Optional[str] = None
    date: Optional[str] = None
    bdrc: Optional[str] = None
    category_id: Optional[str] = None
    alt_titles: List[Dict[str, str]] = Field(
        default=[],
        example=[{"bo": "མཚན་གཞན", "en": "Alternative Title"}],
        description="Alternative titles in multiple languages"
    )
    copyright: Optional[str] = None
    license: Optional[str] = None


class UpdateText(BaseModel):
    title: Optional[Dict[str, str]] = None
    bdrc: Optional[str] = None
    wiki: Optional[str] = None
    copyright: Optional[str] = None
    license: Optional[str] = None
    contributions: Optional[List[Contribution]] = None
    date: Optional[str] = None
    alt_title: Optional[Dict[str, List[str]]] = None

class Annotation(BaseModel):
    annotation_id: str
    type: str

class BibliographyAnnotation(BaseModel):
    span: Dict[str, int] = Field(
        ...,
        example={"start": 0, "end": 100},
        description="Text span with start and end positions"
    )
    type: str = Field(
        ...,
        example="title",
        description="Annotation type: citation, reference, title, colophon, incipit, person"
    )

class InstanceMetadata(BaseModel):
    id: str
    type: str
    copyright: str
    bdrc: Optional[str] = None
    wiki: Optional[str] = None
    colophon: Optional[str] = None
    incipit_title: Optional[Dict[str, str]] = Field(
        default=None,
        example={"bo": "མགོ་ཚིག", "en": "Incipit Title"},
        description="Incipit title in multiple languages"
    )
    alt_incipit_titles: Optional[List[Dict[str, str]]] = Field(
        default=None,
        example=[{"bo": "མགོ་ཚིག་གཞན", "en": "Alternative Incipit"}],
        description="Alternative incipit titles in multiple languages"
    )

class Instance(BaseModel):
    content: Optional[str] = None
    metadata: Optional[InstanceMetadata] = None
    annotations: Optional[List[Annotation]] = None
    biblography_annotation: Optional[List[BibliographyAnnotation]] = None

class InstanceListItem(BaseModel):
    id: str
    type: str
    source: Optional[str] = None
    bdrc: Optional[str] = None
    wiki: Optional[str] = None
    colophon: Optional[str] = None
    incipit_title: Optional[Dict[str, str]] = Field(
        default=None,
        example={"bo": "མགོ་ཚིག", "en": "Incipit Title"},
        description="Incipit title in multiple languages"
    )
    alt_incipit_titles: Optional[List[Dict[str, str]]] = Field(
        default=None,
        example=[{"bo": "མགོ་ཚིག་གཞན", "en": "Alternative Incipit"}],
        description="Alternative incipit titles in multiple languages"
    )

class CreateInstance(BaseModel):
    metadata: Dict[str, Any]
    annotation: List[Dict[str, Any]]
    biblography_annotation: Optional[List[BibliographyAnnotation]] = None
    content: str
    user: Optional[str] = None
    
class UpdateInstance(BaseModel):
    metadata: Dict[str, Any]
    annotation: List[Dict[str, Any]]
    biblography_annotation: Optional[List[BibliographyAnnotation]] = None
    content: str
    user: Optional[str] = None

class CreateInstanceResponse(BaseModel):
    message: str
    id: str





@router.get("")
async def get_texts(
    limit: int = 30,
    offset: int = 0,
    language: Optional[str] = None,
    author: Optional[str] = None,
    type: Optional[Literal["root", "commentary", "translation", "translation_source", "none"]] = Query(
        None,
        description="Filter by text type"
    ),
    title: Optional[str] = None,
):
    return openpecha_list_texts(
        limit=limit,
        offset=offset,
        language=language,
        author=author,
        text_type=type,
        title=title,
    )

@router.post("", status_code=201)
async def create_text(text: CreateText):
    payload = text.model_dump(exclude_none=True)
    return openpecha_create_text(payload)

@router.get("/{id}", response_model=Text)
async def get_text(id: str):
    return openpecha_get_text(id)


@router.put("/{id}")
async def update_text(id: str, text: UpdateText):
    return openpecha_update_text(id, text.model_dump(exclude_none=True))

@router.get("/{id}/instances")
async def get_instances(id: str):
    data = openpecha_list_instances_for_text(id)
    if isinstance(data, dict) and "results" in data:
        return data["results"]
    if isinstance(data, list):
        return data
    return []

@router.post("/{id}/instances",  status_code=201)
async def create_instance(id: str, instance: CreateInstance):
    payload = instance.model_dump(exclude_none=True)
    payload.pop("user", None)
    return openpecha_create_instance_for_text(id, payload)


@router.put("/instances/{instance_id}", status_code=200)
async def update_instance(instance_id: str, instance: UpdateInstance):
    payload = instance.model_dump(exclude_none=True)
    return openpecha_update_instance(instance_id, payload)

@router.get("/instances/{instance_id}")
async def get_instance(instance_id: str, annotation: bool = True):
    return openpecha_get_instance(instance_id, annotation=annotation, content=True)




