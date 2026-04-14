"""Auth and authorization dependencies for outliner HTTP routes."""

from __future__ import annotations

import json

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func
from sqlalchemy.orm import Session

from core.auth0_access_token import email_from_access_token_claims, verify_auth0_access_token
from core.database import get_db
from user.models.user import User

OUTLINER_PERMISSION = "outliner"
_ALLOWED_OUTLINER_ROLES = frozenset({"admin", "reviewer", "annotator"})

_outliner_bearer = HTTPBearer(auto_error=False)


def _parse_permissions(permissions_raw: str | None) -> list[str]:
    if not permissions_raw:
        return []
    try:
        parsed = json.loads(permissions_raw)
        return [p.strip() for p in parsed] if isinstance(parsed, list) else []
    except (json.JSONDecodeError, TypeError):
        return [p.strip() for p in permissions_raw.split(",") if p.strip()]


def require_outliner_access(
    creds: HTTPAuthorizationCredentials | None = Depends(_outliner_bearer),
    db: Session = Depends(get_db),
) -> User:
    """Validate Auth0 access token (Bearer) and ensure the user may use outliner APIs."""
    if (
        not creds
        or creds.scheme.lower() != "bearer"
        or not (creds.credentials or "").strip()
    ):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Authorization bearer token",
        )
    payload = verify_auth0_access_token(creds.credentials.strip())
    email = email_from_access_token_claims(payload)
    if not email:
        raise HTTPException(
            status_code=401,
            detail="Token is missing an email claim (add email to the access token via an Auth0 Action if needed)",
        )

    user = db.query(User).filter(func.lower(User.email) == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    perms = _parse_permissions(user.permissions)
    if OUTLINER_PERMISSION not in perms:
        raise HTTPException(status_code=403, detail="Unauthorized")

    role = (user.role or "user").strip().lower()
    if role not in _ALLOWED_OUTLINER_ROLES:
        raise HTTPException(status_code=403, detail="Unauthorized")

    return user


def apply_authenticated_segment_reviewer(patch: dict, user: User) -> None:
    """Ignore client-supplied reviewer_id; set it from the token when status is reviewer-tracked."""
    patch.pop("reviewer_id", None)
    if patch.get("status") in ("checked", "approved"):
        patch["reviewer_id"] = user.id


def apply_authenticated_segment_reviewer_bulk(updates: list[dict] | None, user: User) -> None:
    if not updates:
        return
    for row in updates:
        apply_authenticated_segment_reviewer(row, user)
