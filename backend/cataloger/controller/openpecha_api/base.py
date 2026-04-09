import os
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv(override=True)

OPENPECHA_ENDPOINT_ENV = "OPENPECHA_ENDPOINT"
OPENPECHA_API_KEY_ENV = "OPENPECHA_API_KEY"
OPENPECHA_X_APPLICATION_ENV = "OPENPECHA_X_APPLICATION"
MISSING_ENDPOINT_DETAIL = "OPENPECHA_ENDPOINT environment variable is not set"

API_V2_PREFIX = "/v2"


def require_openpecha_base_url() -> str:
    base = os.getenv(OPENPECHA_ENDPOINT_ENV)
    if not base:
        raise HTTPException(status_code=500, detail=MISSING_ENDPOINT_DETAIL)
    return base.rstrip("/")


def openpecha_url(*path_parts: str) -> str:
    base = require_openpecha_base_url()
    tail = "/".join(p.strip("/") for p in path_parts if p)
    return f"{base}{API_V2_PREFIX}/{tail}"


def openpecha_headers(*, x_application: Optional[str] = None) -> Dict[str, str]:
    headers: Dict[str, str] = {"Accept": "application/json"}
    api_key = os.getenv(OPENPECHA_API_KEY_ENV)
    if api_key:
        headers["X-API-Key"] = api_key
    app = x_application if x_application is not None else os.getenv(OPENPECHA_X_APPLICATION_ENV)
    if app:
        headers["X-Application"] = app
    return headers


def json_headers(*, x_application: Optional[str] = None) -> Dict[str, str]:
    h = openpecha_headers(x_application=x_application)
    h["Content-Type"] = "application/json"
    return h
