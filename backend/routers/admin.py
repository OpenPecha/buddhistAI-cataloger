from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
from dotenv import load_dotenv
from controller.admin import get_permission
load_dotenv( override=True)

router = APIRouter()

@router.post("/permission")
def get_permission_router(email: str):
    return  get_permission(email)