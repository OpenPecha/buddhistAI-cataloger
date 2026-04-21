from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
import os
from dotenv import load_dotenv

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
    title: Dict[str, str] = Field(
        ...,
        example={"bo": "སྤྱོད་པའི་གླུ།"},
        description="Title in multiple languages, keyed by language code"
    )
    language: str
    bdrc: Optional[str] = None
    wiki: Optional[str] = None
    date: Optional[str] = None
    alt_titles: Optional[List[Dict[str, str]]] = Field(
        default=None,
        example=[{"cmg": "yabudal-un dagulal kemegdeküi"}],
        description="Alternative titles in multiple languages"
    )
    commentary_of: Optional[str] = None
    translation_of: Optional[str] = None
    category_id: Optional[str] = None
    license: Optional[str] = None
    contributions: Optional[List[Contribution]] = None
    commentaries: Optional[List[str]] = Field(
        default=None,
        description="List of commentary text IDs"
    )
    translations: Optional[List[str]] = Field(
        default=None,
        description="List of translation text IDs"
    )
    editions: Optional[List[str]] = Field(
        default=None,
        description="List of edition IDs"
    )
    tag_ids: Optional[List[str]] = Field(
        default=None,
        description="List of tag IDs"
    )
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class TextResponse(BaseModel):
    results: List[Text]
    count: int

class CreateTextResponse(BaseModel):
    message: str
    id: str

class CreateText(BaseModel):
    title: Dict[str, str] = Field(
        ...,
        example={"bo": "དཔེ་མཚོན་ཞིག"},
        description="Title in multiple languages, keyed by language code"
    )
    alt_titles: Optional[List[Dict[str, str]]] = Field(
        default=None,
        example=[{"bo": "མཚན་གཞན"}],
        description="Alternative titles in multiple languages"
    )
    language: str = Field(
        ...,
        example="bo",
        description="ISO 639-1 or 639-3 language code"
    )
    bdrc: Optional[str] = Field(default=None, description="BDRC identifier")
    wiki: Optional[str] = Field(default=None, description="Wikidata identifier")
    date: Optional[str] = Field(default=None, example="1600", description="Date as string")
    commentary_of: Optional[str] = Field(default=None, description="Text ID this is a commentary of")
    translation_of: Optional[str] = Field(default=None, description="Text ID this is a translation of")
    category_id: str = Field(..., description="Category ID for this text")
    license: Optional[str] = Field(default=None, example="public", description="License of the text")
    contributions: List[Dict[str, Optional[str]]] = Field(
        ...,
        example=[
            {"person_id": "string", "person_bdrc_id": "string", "role": "translator"},
            {"ai_id": "string", "role": "translator"}
        ],
        description="List of contributors with roles. Either 'person_id', 'person_bdrc_id', or 'ai_id', plus 'role'"
    )
    tag_ids: Optional[List[str]] = Field(
        default=None,
        example=["tag1", "tag2"],
        description="List of tag IDs for the text"
    )


class UpdateText(BaseModel):
    title: Optional[Dict[str, str]] = None
    bdrc: Optional[str] = None
    wiki: Optional[str] = None
    copyright: Optional[str] = None
    license: Optional[str] = None
    contributions: Optional[List[Contribution]] = None
    date: Optional[str] = None
    alt_title: Optional[Dict[str, List[str]]] = None
    category_id: Optional[str] = None

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

class EditionMetadata(BaseModel):
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

class Edition(BaseModel):
    content: Optional[str] = None
    metadata: Optional[EditionMetadata] = None
    annotations: Optional[List[Annotation]] = None
    biblography_annotation: Optional[List[BibliographyAnnotation]] = None

class EditionListItem(BaseModel):
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

class CreateEdition(BaseModel):
    metadata: Dict[str, Any]
    annotation: List[Dict[str, Any]]
    biblography_annotation: Optional[List[BibliographyAnnotation]] = None
    content: str
    user: Optional[str] = None
    
class UpdateEdition(BaseModel):
    metadata: Dict[str, Any]
    annotation: List[Dict[str, Any]]
    biblography_annotation: Optional[List[BibliographyAnnotation]] = None
    content: str
    user: Optional[str] = None

class CreateEditionResponse(BaseModel):
    message: str
    id: str





@router.get("")
async def get_texts(
    limit: int = 30,
    offset: int = 0,
    language: Optional[str] = None,
    author: Optional[str] = None,
    title: Optional[str] = None,
    category_id: Optional[str] = Query(None, description="Filter by category id"),
):
    return openpecha_list_texts(
        limit=limit,
        offset=offset,
        language=language,
        author=author,
        title=title,
        category_id=category_id,
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

@router.get("/{id}/editions")
async def get_editions(id: str):
    data = openpecha_list_instances_for_text(id)
    if isinstance(data, dict) and "results" in data:
        return data["results"]
    if isinstance(data, list):
        return data
    return []

@router.post("/{id}/editions",  status_code=201)
async def create_edition(id: str, edition: CreateEdition):
    payload = edition.model_dump(exclude_none=True)
    payload.pop("user", None)
    return openpecha_create_instance_for_text(id, payload)

