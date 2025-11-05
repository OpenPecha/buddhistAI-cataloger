from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import requests
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

API_ENDPOINT = os.getenv("OPENPECHA_ENDPOINT")

class PersonName(BaseModel):
    en: Optional[str] = None
    bo: Optional[str] = None

class AltNames(BaseModel):
    en: Optional[str] = None
    bo: Optional[str] = None


class Person(BaseModel):
    id: str
    name: PersonName
    alt_names: List[AltNames] = []
    bdrc: Optional[str] = None
    wiki: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class PersonResponse(BaseModel):
    results: List[Person]
    count: int
    limit: int
    offset: int

class CreatePerson(BaseModel):
    name: PersonName
    alt_names: List[AltNames] = []
    bdrc: Optional[str] = ""
    wiki: Optional[str] = ""


@router.get("/", response_model=List[Person])
async def get_persons(
    limit: int = 30,
    offset: int = 0,
    nationality: Optional[str] = None,
    occupation: Optional[str] = None,
    search: Optional[str] = None,
):
    params = {
        "limit": limit,
        "offset": offset,
        "nationality": nationality,
        "occupation": occupation,
        "search": search,
    }
    # remove none values
    params = {k: v for k, v in params.items() if v is not None}
    
    response = requests.get(f"{API_ENDPOINT}/persons", params=params)
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()

@router.get("/{id}", response_model=Person)
async def get_person(id: str):
    response = requests.get(f"{API_ENDPOINT}/persons/{id}")
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()

@router.post("", response_model=Person, status_code=201)
async def create_person(person: CreatePerson):
    response = requests.post(f"{API_ENDPOINT}/persons", json=person.dict())
    if response.status_code != 201:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()
