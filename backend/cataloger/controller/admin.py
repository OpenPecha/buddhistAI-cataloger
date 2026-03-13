import json
from fastapi import HTTPException
from sqlalchemy.orm import Session

from user.models.user import User

CATALOGER_PERMISSION = "cataloger"


def _parse_permissions(permissions_raw: str | None) -> list[str]:
    if not permissions_raw:
        return []
    try:
        parsed = json.loads(permissions_raw)
        return [p.strip() for p in parsed] if isinstance(parsed, list) else []
    except (json.JSONDecodeError, TypeError):
        return [p.strip() for p in permissions_raw.split(",") if p.strip()]


def get_permission(email: str, db: Session):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="user not found")
    permissions = _parse_permissions(user.permissions)
    if CATALOGER_PERMISSION not in permissions:
        raise HTTPException(status_code=403, detail="user does not have cataloger permission")
    return {
        "name": user.name,
        "email": user.email,
        "role": user.role or "user",
    }
