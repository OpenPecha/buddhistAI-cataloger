from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import requests
import os
from dotenv import load_dotenv

from utils.segmentor import create_segmentation_annotation

load_dotenv(override=True)

router = APIRouter()

API_ENDPOINT = os.getenv("OPENPECHA_ENDPOINT")
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
    response = requests.get(f"{API_ENDPOINT}/texts/{text_id}/instances")
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()


def create_annotation_background(text_id: str, instance_id: str, content: str, language: str, user: Optional[str] = None):
    """Background task to create segmentation annotation and temp annotation"""
    try:
        if instance_id and content and language:
            annotation_response_id = create_segmentation_annotation(
                instance_id, content, language
            )
            if annotation_response_id and user:
                temp_database_response = requests.post(f"{TRANSLATION_BACKEND_URL}/temp_annotation", json={
                    "textId": text_id,
                    "instanceId": instance_id,
                    "annotationId": annotation_response_id,
                    "createdBy": user
                })
                if temp_database_response.status_code != 201:
                    print(f"Error creating temp annotation: {temp_database_response.text}")
    except Exception as e:
        print(e)


@router.post("/{instance_id}/translation", status_code=201)
async def create_translation(instance_id: str, translation: CreateTranslation, background_tasks: BackgroundTasks):
    """Create a translation for a specific instance"""
    if not API_ENDPOINT:
        raise HTTPException(
            status_code=500,
            detail="OPENPECHA_ENDPOINT environment variable is not set"
        )
    
    try:
        # Convert to dict, excluding None values
        payload = translation.model_dump(exclude_none=True)
        # Extract user before sending to OpenPecha API (user is only for our backend)
        user = payload.pop("user", None)
        response = requests.post(
            f"{API_ENDPOINT}/instances/{instance_id}/translation", 
            json=payload,
            timeout=30
        )
        if response.status_code != 201:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        
        response_data = response.json()
        
        # Schedule background task for annotation creation
        new_instance_id = response_data.get("instance_id")
        content = payload.get("content")
        language = payload.get("language")
        # Get text_id from the response or original instance
        text_id = None
        try:
            # First try to get text_id from the response_data
            text_id = response_data.get("text_id")
            
            # If not in response, try to get from the original instance
            if not text_id:
                instance_response = requests.get(f"{API_ENDPOINT}/instances/{instance_id}")
                if instance_response.status_code == 200:
                    instance_data = instance_response.json()
                    text_id = instance_data.get("text_id")
                else:
                    print(f"❌ Failed to fetch instance: {instance_response.status_code}")
            print(text_id,len(content),language,new_instance_id)
            if new_instance_id and content and text_id and language:
                background_tasks.add_task(
                    create_annotation_background,
                    text_id=text_id,
                    instance_id=new_instance_id,
                    content=content,
                    language=language,
                    user=user
                )
            else:
                print(f"❌ Background task not scheduled - Missing: new_instance_id={bool(new_instance_id)}, content={bool(content)}, text_id={bool(text_id)}, language={bool(language)}")
        except Exception as e:
            print(f"❌ Error scheduling background task: {e}")
            import traceback
            traceback.print_exc()
        
        return response_data
    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=504,
            detail="Request to OpenPecha API timed out after 30 seconds"
        )
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error connecting to OpenPecha API: {str(e)}"
        )


@router.post("/{instance_id}/commentary", status_code=201)
async def create_commentary(instance_id: str, commentary: CreateCommentary, background_tasks: BackgroundTasks):
    """Create a commentary for a specific instance"""
    if not API_ENDPOINT:
        raise HTTPException(
            status_code=500,
            detail="OPENPECHA_ENDPOINT environment variable is not set"
        )
    
    try:
        # Convert to dict, excluding None values
        payload = commentary.model_dump(exclude_none=True)
        # Extract user before sending to OpenPecha API (user is only for our backend)
        user = payload.pop("user", None)
        response = requests.post(
            f"{API_ENDPOINT}/instances/{instance_id}/commentary", 
            json=payload,
            timeout=30
        )
        if response.status_code != 201:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        
        response_data = response.json()
        
        # Schedule background task for annotation creation
        new_instance_id = response_data.get("instance_id")
        content = payload.get("content")
        language = payload.get("language")
        # Get text_id from the original instance
        try:
            instance_response = requests.get(f"{API_ENDPOINT}/instances/{instance_id}")
            if instance_response.status_code == 200:
                text_id = instance_response.json().get("text_id")
                if new_instance_id and content and text_id and language:
                    background_tasks.add_task(
                        create_annotation_background,
                        text_id=text_id,
                        instance_id=new_instance_id,
                        content=content,
                        language=language,
                        user=user
                    )
        except Exception as e:
            print(f"Error scheduling background task: {e}")
        
        return response_data
    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=504,
            detail="Request to OpenPecha API timed out after 30 seconds"
        )
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error connecting to OpenPecha API: {str(e)}"
        )


@router.get("/{instance_id}/related")
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


