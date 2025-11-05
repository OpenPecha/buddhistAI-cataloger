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
