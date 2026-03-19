from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
from dotenv import load_dotenv

from bdrc import search as bdrc_search_module
from bdrc import work as bdrc_work_module
from bdrc import person as bdrc_person_module

load_dotenv(override=True)

router = APIRouter()


class Creator(BaseModel):
    creator: Optional[str] = None
    agent: Optional[str] = None
    agentName: Optional[str] = None
    role: Optional[str] = None
    roleName: Optional[str] = None


class AuthorInfo(BaseModel):
    """Author in work search result: id and name (from pref_label_bo)."""
    id: Optional[str] = None
    name: Optional[str] = None


class WorkDetail(BaseModel):
    """Work search result; matches OTAPI works/search shape and frontend BdrcSearchResult."""
    workId: str
    instanceId: Optional[str] = None
    title: Optional[str] = None
    language: Optional[str] = None
    entityScore: Optional[int] = None
    # OTAPI work fields
    title: Optional[str] = None
    alt_label_bo: List[str] = []
    authors: List[AuthorInfo] = []
    versions: List[Dict[str, Any]] = []


class BdrcSearchRequest(BaseModel):
    search_query: str
    from_: int = Field(default=0, alias="from")
    size: int = 20
    filter: List[Any] = []
    type: Literal["Work", "Person"] = "Work"  # Can be "Instance", "Text", "Volume", "Person"


class CreateWorkRequest(BaseModel):
    """Request body for creating a work via BDRC OTAPI POST /api/v1/works."""

    pref_label_bo: Optional[str] = None
    alt_label_bo: Optional[List[str]] = None
    authors: Optional[List[str]] = None
    versions: Optional[List[str]] = None
    modified_by: Optional[str] = None


class CreatePersonRequest(BaseModel):
    """Request body for creating a person via BDRC OTAPI POST /api/v1/persons."""

    pref_label_bo: Optional[str] = None
    alt_label_bo: Optional[List[str]] = None
    dates: Optional[str] = None
    modified_by: Optional[str] = None


def _normalize_person_results(raw: Dict[str, Any], max_results: int = 10) -> List[Dict[str, Any]]:
    """Normalize OTAPI persons search response to [{ bdrc_id, name }] for frontend."""
    items: List[Dict[str, Any]] = []
    if isinstance(raw, list):
        items = raw
    elif isinstance(raw, dict):
        items = raw.get("results") or raw.get("items") or raw.get("data") or []
    items = items[:max_results] if isinstance(items, list) else []
    out = []
    for item in items:
        if not isinstance(item, dict):
            continue
        bdrc_id = item.get("id")
        if not bdrc_id:
            continue
        name = item.get("name") or item.get("pref_label_bo")
       
        out.append({"bdrc_id": str(bdrc_id), "name": name or ""})
    return out


def _parse_works_response(raw: Any, size: int = 20) -> List[WorkDetail]:
    """Parse OTAPI works/search response into List[WorkDetail]. Response is list of works with id, pref_label_bo, authors, versions, etc."""
    items: List[Dict[str, Any]] = []
    if isinstance(raw, list):
        items = raw
    elif isinstance(raw, dict):
        items = raw.get("results") or raw.get("items") or raw.get("data") or raw.get("works") or []
    if not isinstance(items, list):
        items = []
    items = items[:size]
    out: List[WorkDetail] = []
    for item in items:
        work_id = item.get("id")
        title = item.get("pref_label_bo")
        alt_label_bo = item.get("alt_label_bo")
        versions = item.get("versions")
        db_score = item.get("db_score")
        # Build authors as [{id, name}] from author_records (pref_label_bo as name), fallback to author IDs
        author_records = item.get("author_records") or []
        author_ids = item.get("authors") or []
        authors_out: List[AuthorInfo] = []
        if author_records:
            for rec in author_records:
                if isinstance(rec, dict):
                    authors_out.append(AuthorInfo(
                        id=rec.get("id"),
                        name=rec.get("pref_label_bo"),
                    ))
        if not authors_out and author_ids:
            for aid in author_ids:
                authors_out.append(AuthorInfo(id=str(aid) if aid else None, name=None))
        out.append(WorkDetail(
            workId=str(work_id),
            title=title,
            authors=authors_out,
            language=None,
            entityScore=db_score,
            alt_label_bo=alt_label_bo,
            versions=versions,
        ))
    return out


@router.post("/search")
async def bdrc_search(request: BdrcSearchRequest):
    """Search BDRC database using bdrc.search (OTAPI). Returns same response shape as before."""
    query = (request.search_query or "").strip()
    size = max(1, min(request.size or 20, 100))
    from_offset = max(0, request.from_ or 0)

    if not query:
        return []

    try:
        if request.type == "Person":
            raw = await bdrc_search_module.search_persons(author_name=query if query else None)
            formatted = _normalize_person_results(raw, max_results=10)
            return formatted[from_offset : from_offset + size]

        if request.type == "Work":
            raw = await bdrc_search_module.search_works(title=query if query else None)
            work_details = _parse_works_response(raw, size=size)
            return work_details[from_offset : from_offset + size]

        return []
    except TimeoutError:
        raise HTTPException(status_code=504, detail="Request to BDRC API timed out")
    except ConnectionError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/works/{work_id}")
async def get_work(work_id: str):
    """Get a work from BDRC by work ID. Returns title and author for display."""
    try:
        raw = await bdrc_work_module.get_work(work_id)
    except TimeoutError:
        raise HTTPException(status_code=504, detail="Request to BDRC API timed out")
    except ConnectionError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Normalize OTAPI response for frontend display
    title = raw.get("pref_label_bo") or (raw.get("alt_label_bo") or [None])[0] or ""
    authors_raw = raw.get("author_records") or []
    authors: List[Dict[str, Any]] = []
    for a in authors_raw:
        if isinstance(a, dict):
            name = a.get("pref_label_bo") or a.get("name") or str(a)
            author_id = a.get("id") or None
            authors.append({"id": author_id, "name": name or ""})
        else:
            authors.append({"id": None, "name": str(a) if a else ""})

    return {
        "workId": raw.get("id", work_id),
        "title": title,
        "authors": authors,
    }


@router.post("/works")
async def create_work(request: CreateWorkRequest):
    """Create a work in BDRC via OTAPI POST /api/v1/works."""
    try:
        result = await bdrc_work_module.create_work(
            pref_label_bo=request.pref_label_bo,
            alt_label_bo=request.alt_label_bo,
            authors=request.authors,
            versions=request.versions,
            modified_by=request.modified_by,
        )
        return result
    except TimeoutError:
        raise HTTPException(status_code=504, detail="Request to BDRC API timed out")
    except ConnectionError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/persons")
async def create_person(request: CreatePersonRequest):
    """Create a person in BDRC via OTAPI POST /api/v1/persons."""
    try:
        result = await bdrc_person_module.create_person(
            pref_label_bo=request.pref_label_bo,
            alt_label_bo=request.alt_label_bo,
            dates=request.dates,
            modified_by=request.modified_by,
        )
        return result
    except TimeoutError:
        raise HTTPException(status_code=504, detail="Request to BDRC API timed out")
    except ConnectionError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
