import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Annotated, Dict, Any, Tuple
from dotenv import load_dotenv

from core.auth0_access_token import email_from_access_token_claims
from core.database import get_db
from cataloger.controller.admin import get_permission
from user.routers.user import require_access_token_payload

load_dotenv(override=True)

router = APIRouter()

_PERMISSION_CACHE_TTL_SEC = 300  # 5 minutes
_permission_cache: Dict[str, Tuple[Any, float]] = {}


@router.get("/permission")
def get_permission_router(
    payload: Annotated[dict, Depends(require_access_token_payload)],
    db: Annotated[Session, Depends(get_db)],
):
    """Permissions for the caller; email is taken from the access token (not from query/body)."""
    email = email_from_access_token_claims(payload)
    if not email:
        raise HTTPException(
            status_code=401,
            detail="Token is missing an email claim (add email to the access token via an Auth0 Action if needed)",
        )
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