import time
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Annotated, Dict, Any, Tuple
from dotenv import load_dotenv

from core.database import get_db
from cataloger.controller.admin import get_permission

load_dotenv(override=True)

router = APIRouter()

_PERMISSION_CACHE_TTL_SEC = 300  # 5 minutes
_permission_cache: Dict[str, Tuple[Any, float]] = {}


@router.post("/permission")
def get_permission_router(email: str, db: Annotated[Session, Depends(get_db)]):
    now = time.monotonic()
    entry = _permission_cache.get(email)
    if entry is not None:
        cached_value, expiry = entry
        if now < expiry:
            return cached_value
        del _permission_cache[email]
    result = get_permission(email, db)
    _permission_cache[email] = (result, now + _PERMISSION_CACHE_TTL_SEC)
    return result