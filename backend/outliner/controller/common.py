"""Shared controller helpers."""
from typing import Optional

from fastapi import HTTPException


def none_check(raw: Optional[str], error_message: str) -> str:
    if raw is None or not str(raw).strip():
        raise HTTPException(status_code=422, detail=error_message)
    return str(raw).strip()
