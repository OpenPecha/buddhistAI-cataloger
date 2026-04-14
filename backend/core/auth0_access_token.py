"""Verify Auth0 API access tokens (JWT) using the tenant JWKS."""

from __future__ import annotations

import os
from functools import lru_cache

import jwt
from jwt import PyJWKClient
from fastapi import HTTPException


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient:
    domain = os.getenv("AUTH0_DOMAIN", "").strip().rstrip("/")
    if not domain:
        raise RuntimeError("AUTH0_DOMAIN is not set")
    if "://" in domain:
        base = domain
    else:
        base = f"https://{domain}"
    return PyJWKClient(f"{base}/.well-known/jwks.json")


def email_from_access_token_claims(payload: dict) -> str:
    """Email from standard claim or a namespaced custom claim (e.g. Auth0 Action)."""
    raw = payload.get("email")
    if isinstance(raw, str) and raw.strip():
        return raw.strip().lower()
    for key, val in payload.items():
        if (
            isinstance(key, str)
            and key.endswith("/email")
            and isinstance(val, str)
            and val.strip()
        ):
            return val.strip().lower()
    return ""


def subject_from_access_token_claims(payload: dict) -> str:
    """Auth subject (`sub`), used as stable user id for first-time DB provisioning."""
    raw = payload.get("sub")
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    return ""


def verify_auth0_access_token(token: str) -> dict:
    """Decode and validate an Auth0-issued access token for this API; return claims dict."""
    domain = os.getenv("AUTH0_DOMAIN", "").strip().rstrip("/")
    audience = os.getenv("AUTH0_AUDIENCE", "").strip()
    if not domain or not audience:
        raise HTTPException(
            status_code=500,
            detail="Server Auth0 configuration is incomplete (AUTH0_DOMAIN, AUTH0_AUDIENCE)",
        )
    issuer = domain if domain.startswith("http") else f"https://{domain}/"
    if not issuer.endswith("/"):
        issuer = issuer + "/"

    try:
        jwks = _jwks_client()
    except RuntimeError as e:
        raise HTTPException(
            status_code=500,
            detail="Server Auth0 configuration is incomplete",
        ) from e

    try:
        signing_key = jwks.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=audience,
            issuer=issuer,
            leeway=60,
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail="Invalid token") from e
    except Exception as e:
        raise HTTPException(status_code=401, detail="Could not verify token") from e

    return payload
