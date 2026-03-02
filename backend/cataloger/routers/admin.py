import time
from fastapi import APIRouter
from typing import  Dict, Any, Tuple
from dotenv import load_dotenv
from cataloger.controller.admin import get_permission
load_dotenv( override=True)

router = APIRouter()

_PERMISSION_CACHE_TTL_SEC = 300  # 5 minutes
_permission_cache: Dict[str, Tuple[Any, float]] = {}


@router.post("/permission")
def get_permission_router(email: str):
    now = time.monotonic()
    entry = _permission_cache.get(email)
    if entry is not None:
        cached_value, expiry = entry
        if now < expiry:
            return cached_value
        del _permission_cache[email]
    result = get_permission(email)
    _permission_cache[email] = (result, now + _PERMISSION_CACHE_TTL_SEC)
    return result