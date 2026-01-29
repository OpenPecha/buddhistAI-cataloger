from fastapi import APIRouter, Query
from dotenv import load_dotenv
from controller.enum import get_enum
load_dotenv(override=True)

router = APIRouter()

@router.get("")
def get_enum_router(
    type: str = Query(..., description="Enum type (e.g., 'language', 'role')")
):
    return get_enum(type)

