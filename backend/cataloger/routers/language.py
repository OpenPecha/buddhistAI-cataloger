from fastapi import APIRouter, HTTPException

from cataloger.controller.openpecha_api.language import get_language

router = APIRouter()

@router.get("/languages")
async def languages():
    return get_language()