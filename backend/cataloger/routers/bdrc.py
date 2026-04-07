from typing import Annotated, Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from sqlalchemy.orm import Session

from bdrc import search as bdrc_search_module
from bdrc import work as bdrc_work_module
from bdrc import person as bdrc_person_module
from core.database import get_db
from outliner.controller.outliner import sync_completed_documents_to_bdrc_in_review

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
    canonical_id: Optional[str] = None
    origin: Optional[str] = None
    record_status: Optional[str] = None
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


class UpdateWorkRequest(BaseModel):
    """Request body for updating a work via BDRC OTAPI PUT /api/v1/works/{work_id}."""

    pref_label_bo: Optional[str] = None
    alt_label_bo: Optional[List[str]] = None
    authors: Optional[List[str]] = None
    versions: Optional[List[str]] = None
    modified_by: Optional[str] = None


class FindMatchingWorkRequest(BaseModel):
    """Request body for BDRC OTAPI POST /api/v1/matching/find-work."""

    text_bo: Optional[str] = None
    volume_id: Optional[str] = None
    cstart: Optional[int] = None
    cend: Optional[int] = None


class MergeWorksRequest(BaseModel):
    """Merge a duplicate work into the current (canonical) work via OTAPI POST /api/v1/works/{work_id}/merge."""

    parent_work_id: str = Field(..., description="Canonical work ID (survives after merge)")
    searched_work_id: str = Field(..., description="Duplicate work ID from search to merge into parent")
    modified_by: Optional[str] = None


class MergePersonsRequest(BaseModel):
    """Merge a duplicate person into the canonical person via OTAPI POST /api/v1/persons/{person_id}/merge."""

    parent_person_id: str = Field(..., description="Canonical person ID (survives after merge)")
    searched_person_id: str = Field(..., description="Duplicate person ID from search to merge into parent")
    modified_by: Optional[str] = None


class CreatePersonRequest(BaseModel):
    """Request body for creating a person via BDRC OTAPI POST /api/v1/persons."""

    pref_label_bo: Optional[str] = None
    alt_label_bo: Optional[List[str]] = None
    dates: Optional[str] = None
    modified_by: Optional[str] = None


class BdrcBulkSyncRequest(BaseModel):
    """Optional body for POST /bdrc/sync."""

    document_ids: Optional[List[str]] = Field(
        default=None,
        description=(
            "If set, only these outliner document IDs are candidates. "
            "They must still be completed, have a BDRC volume id (filename), and all segments checked. "
            "Omit or send null to sync all eligible documents."
        ),
    )


def _normalize_bulk_sync_document_ids(raw: Optional[List[str]]) -> Optional[List[str]]:
    if raw is None:
        return None
    out: List[str] = []
    for x in raw:
        if x is None:
            continue
        s = str(x).strip()
        if s and s not in out:
            out.append(s)
    return out


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
        canonical_id = item.get("canonical_id")
        if not bdrc_id:
            continue
        name = item.get("name") or item.get("pref_label_bo")
       
        out.append({"bdrc_id": str(bdrc_id), "name": name or "", "canonical_id": canonical_id or ""})
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
        origin = item.get("origin")
        record_status = item.get("record_status")
        author_ids = item.get("authors") or []
        canonical_id = item.get("canonical_id") or ""
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
            canonical_id=canonical_id,
            origin=origin,
            record_status=record_status,
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


@router.post("/sync")
async def sync_outliner_documents_to_bdrc(
    db: Session = Depends(get_db),
    body: BdrcBulkSyncRequest = Body(default_factory=BdrcBulkSyncRequest),
):
    """
    Push every outliner document that is `completed`, has a BDRC volume id (`filename`),
    has at least one segment, and has all segments `checked` to BDRC with status `in_review`.
    `modified_by` per volume comes from that document's owner (user email, else user id).
    Does not change local document status. Returns per-document success and failure lists.

    JSON body is optional. Send `{"document_ids": ["<uuid>", ...]}` to restrict to those IDs only
    (they must still satisfy the same eligibility rules). `{}` or omitting `document_ids` syncs all eligible.
    """
    try:
        only_ids = _normalize_bulk_sync_document_ids(body.document_ids)
        return await sync_completed_documents_to_bdrc_in_review(db, only_document_ids=only_ids)
    except HTTPException:
        raise
    except TimeoutError:
        raise HTTPException(status_code=504, detail="Request to BDRC API timed out")
    except ConnectionError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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


@router.post("/works/merge")
async def merge_works(
    request: MergeWorksRequest,
    x_user_email: Annotated[Optional[str], Header(alias="X-User-Email")] = None,
):
    """Merge a searched duplicate into the parent work via OTAPI POST /api/v1/works/{work_id}/merge."""
    parent = (request.parent_work_id or "").strip()
    searched = (request.searched_work_id or "").strip()
    if not parent or not searched:
        raise HTTPException(status_code=400, detail="parent_work_id and searched_work_id are required")
    if parent == searched:
        raise HTTPException(status_code=400, detail="Cannot merge a work into itself")
    modified_by = (x_user_email or request.modified_by or "").strip() or None
    try:
        result = await bdrc_work_module.merge_works(
            work_id=searched,
            target_work_id=parent,
            modified_by=modified_by,
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


@router.put("/works/{work_id}")
async def update_work(work_id: str, request: UpdateWorkRequest):
    """Update a work in BDRC via OTAPI PUT /api/v1/works/{work_id}."""
    try:
        result = await bdrc_work_module.update_work(
            work_id=work_id,
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


@router.post("/matching/find-work")
async def find_matching_work(request: FindMatchingWorkRequest):
    """Find a matching work in BDRC via OTAPI POST /api/v1/matching/find-work."""
    try:
        result = await bdrc_work_module.find_matching_work(
            text_bo=request.text_bo,
            volume_id=request.volume_id,
            cstart=request.cstart,
            cend=request.cend,
        )

        # Transform OTAPI response to list of { id: wa_id, name: pref_label_bo, score, authors }
        out = []
        if isinstance(result, list):
            items = result
        elif isinstance(result, dict):
            items = result.get("results") or result.get("items") or result.get("data") or result.get("matched_works") or []
        else:
            items = []

        for item in items:
            if not isinstance(item, dict):
                continue
            wa_id = item.get("wa_id") or item.get("id")
            name = item.get("pref_label_bo") or "unknown"
            score = item.get("score")

            # Send author_records as 'authors'
            authors = item.get("author_records") or []

            # Skip if no id
            if not wa_id:
                continue

            out.append({
                "id": wa_id,
                "name": name,
                "score": score,
                "authors": authors
            })

        return out
    except TimeoutError:
        raise HTTPException(status_code=504, detail="Request to BDRC API timed out")
    except ConnectionError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/persons/merge")
async def merge_persons(
    request: MergePersonsRequest,
    x_user_email: Annotated[Optional[str], Header(alias="X-User-Email")] = None,
):
    """Merge a searched duplicate person into the parent person via OTAPI POST /api/v1/persons/{person_id}/merge."""
    parent = (request.parent_person_id or "").strip()
    searched = (request.searched_person_id or "").strip()
    if not parent or not searched:
        raise HTTPException(status_code=400, detail="parent_person_id and searched_person_id are required")
    if parent == searched:
        raise HTTPException(status_code=400, detail="Cannot merge a person into itself")
    modified_by = (x_user_email or request.modified_by or "").strip() or None
    try:
        result = await bdrc_person_module.merge_persons(
            person_id=searched,
            target_person_id=parent,
            modified_by=modified_by,
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
