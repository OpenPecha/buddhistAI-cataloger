from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import requests
import os
from dotenv import load_dotenv

load_dotenv( override=True)

router = APIRouter()

API_ENDPOINT = os.getenv("OPENPECHA_ENDPOINT")

class Contribution(BaseModel):
    person_id: Optional[str] = None
    ai_id: Optional[str] = None
    role: str

class Text(BaseModel):
    id: str
    type: str
    title: Dict[str, str]
    language: str
    parent: Optional[str] = None
    contributions: List[Contribution]
    date: Optional[str] = None
    bdrc: Optional[str] = None
    wiki: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class TextResponse(BaseModel):
    results: List[Text]
    count: int

class CreateText(BaseModel):
    type: str
    title: Dict[str, str]
    language: str
    contributions: List[Contribution]
    date: Optional[str] = None
    bdrc: Optional[str] = None
    alt_titles: List[Dict[str, str]] = []


class Annotation(BaseModel):
    annotation_id: str
    type: str

class InstanceMetadata(BaseModel):
    id: str
    type: str
    copyright: str
    bdrc: Optional[str] = None
    wiki: Optional[str] = None
    colophon: Optional[str] = None
    incipit_title: Optional[Dict[str, str]] = None
    alt_incipit_titles: Optional[List[Dict[str, str]]] = None

class Instance(BaseModel):
    content: Optional[str] = None
    metadata: Optional[InstanceMetadata] = None
    annotations: Optional[List[Annotation]] = None

class InstanceListItem(BaseModel):
    id: str
    bdrc: Optional[str] = None
    wiki: Optional[str] = None
    type: str
    copyright: str
    colophon: Optional[str] = None
    incipit_title: Optional[Dict[str, str]] = None
    alt_incipit_titles: Optional[List[Dict[str, str]]] = None

class CreateInstance(BaseModel):
    metadata: Dict[str, Any]
    annotation: List[Dict[str, Any]]
    content: str


@router.get("", response_model=List[Text])
async def get_texts(
    limit: int = 30,
    offset: int = 0,
    language: Optional[str] = None,
    author: Optional[str] = None,
):
    params = {
        "limit": limit,
        "offset": offset,
        "language": language,
        "author": author,
    }
    params = {k: v for k, v in params.items() if v is not None}
    response = requests.get(f"{API_ENDPOINT}/texts", params=params)
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()

@router.post("", response_model=Text, status_code=201)
async def create_text(text: CreateText):
    response = requests.post(f"{API_ENDPOINT}/texts", json=text.dict())
    if response.status_code != 201:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()

@router.get("/{id}", response_model=Text)
async def get_text(id: str):
    response = requests.get(f"{API_ENDPOINT}/texts/{id}")
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()

@router.get("/{id}/instances", response_model=List[InstanceListItem])
async def get_instances(id: str):
    response = requests.get(f"{API_ENDPOINT}/texts/{id}/instances")
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()

@router.post("/{id}/instances", status_code=201)
async def create_instance(id: str, instance: CreateInstance):
    response = requests.post(f"{API_ENDPOINT}/texts/{id}/instances", json=instance.dict())
    if response.status_code != 201:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()

@router.get("/instances/{instance_id}", response_model=Instance)
async def get_instance(instance_id: str, annotation: bool = True):
    params = {"annotation": str(annotation).lower()}
    response = requests.get(f"{API_ENDPOINT}/instances/{instance_id}", params=params)
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()
