"""HTTPS image proxy for the outliner UI (IIIF, reviewer avatars). Host allowlist only.

Optional ``IMAGE_PROXY_BDRC_KEY``: for ``iiif.bdrc.io`` requests, sends
``Authorization: XBdrcKey`` plus the key base64-encoded (same as curl ``echo -n "$KEY" | base64``).
"""

from __future__ import annotations

import base64
import os
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from starlette.responses import Response

from outliner.deps import require_outliner_access

router = APIRouter()
_DEFAULT_ALLOWED_HOSTS = (
    "iiif.bdrc.io,googleusercontent.com,avatars.githubusercontent.com"
)
_DEFAULT_MAX_BYTES = 25 * 1024 * 1024
_IIIF_BDRC_HOST_RULES = ("iiif.bdrc.io",)


def _bdrc_iiif_authorization_value() -> str | None:
    """Authorization header value for BDRC IIIF (`XBdrcKey` + base64(key)), or None if unset."""
    key = os.getenv("IMAGE_PROXY_BDRC_KEY", "").strip()
    if not key:
        return None
    b64 = base64.b64encode(key.encode("utf-8")).decode("ascii")
    return f"XBdrcKey {b64}"


def _allowed_host_rules() -> list[str]:
    raw = os.getenv("IMAGE_PROXY_ALLOWED_HOSTS", _DEFAULT_ALLOWED_HOSTS)
    return [x.strip().lower().lstrip(".") for x in raw.split(",") if x.strip()]


def _host_matches(hostname: str, rules: list[str]) -> bool:
    h = hostname.lower().rstrip(".")
    for rule in rules:
        if h == rule or h.endswith("." + rule):
            return True
    return False


def _max_bytes() -> int:
    try:
        return int(os.getenv("IMAGE_PROXY_MAX_BYTES", str(_DEFAULT_MAX_BYTES)))
    except ValueError:
        return _DEFAULT_MAX_BYTES


@router.get("/proxy/image")
async def proxy_external_image(
    url: str = Query(
        ...,
        min_length=8,
        max_length=2048,
        description="Full https URL of an image to fetch",
    ),
    _auth_user: object = Depends(require_outliner_access),
):  
    
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise HTTPException(400, detail="Only https URLs are supported")
    host = parsed.hostname
    if not host:
        raise HTTPException(400, detail="Invalid URL")
    netloc_part = url.split("://", 1)[-1].split("/", 1)[0]
    if "@" in netloc_part:
        raise HTTPException(400, detail="Invalid URL")

    rules = _allowed_host_rules()
    if not _host_matches(host, rules):
        raise HTTPException(403, detail="Image host is not allowlisted")

    max_b = _max_bytes()
    headers = {"User-Agent": "CatalogerImageProxy/1.0"}
    auth = _bdrc_iiif_authorization_value()
    if auth and _host_matches(host, list(_IIIF_BDRC_HOST_RULES)):
        headers["Authorization"] = auth

    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=httpx.Timeout(60.0),
            headers=headers,
        ) as client:
            async with client.stream("GET", url) as r:
                if r.status_code >= 400:
                    raise HTTPException(
                        status_code=502, detail="Upstream image request failed"
                    )
                cl = r.headers.get("content-length")
                if cl:
                    try:
                        if int(cl) > max_b:
                            raise HTTPException(
                                status_code=413, detail="Image too large"
                            )
                    except ValueError:
                        pass
                chunks: list[bytes] = []
                total = 0
                async for chunk in r.aiter_bytes():
                    total += len(chunk)
                    if total > max_b:
                        raise HTTPException(
                            status_code=413, detail="Image too large"
                        )
                    chunks.append(chunk)
                body = b"".join(chunks)
                content_type = r.headers.get("content-type", "image/jpeg")
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=502, detail=f"Could not fetch image: {e!s}"
        ) from e

    ct_main = content_type.split(";")[0].strip().lower()
    if ct_main and not (
        ct_main.startswith("image/")
        or ct_main == "application/octet-stream"
    ):
        raise HTTPException(
            status_code=502, detail="Upstream response is not an image"
        )

    return Response(
        content=body,
        media_type=ct_main or "application/octet-stream",
    )
