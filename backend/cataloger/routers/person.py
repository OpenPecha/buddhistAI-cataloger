from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import List, Optional

from cataloger.controller.openpecha_api.persons import (
    create_person as openpecha_create_person,
    get_person as openpecha_get_person,
    list_persons as openpecha_list_persons,
)

router = APIRouter()


class PersonName(BaseModel):
    en: Optional[str] = None
    bo: Optional[str] = None


class AltNames(BaseModel):
    en: Optional[str] = None
    bo: Optional[str] = None


class Person(BaseModel):
    id: str
    name: PersonName
    alt_names: Optional[List[AltNames]] = []
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


class CreatePersonResponse(BaseModel):
    message: str
    id: str = Field(alias="_id")

    class Config:
        populate_by_name = True


@router.get("", response_model=List[Person])
async def get_persons(
    name: Optional[str] = None,
    bdrc: Optional[str] = None,
    wiki: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
):
    # Fetch persons with filtering if params supplied.
    return openpecha_list_persons(
        limit=limit,
        offset=offset,
        name=name,
        bdrc=bdrc,
        wiki=wiki,
    )


@router.get("/{id}", response_model=Person)
async def get_person(id: str):
    return openpecha_get_person(id)


@router.post("", response_model=CreatePersonResponse, status_code=201)
async def create_person(person: CreatePerson):
    payload = person.model_dump(exclude_none=True)
    return openpecha_create_person(payload)
