"""Outliner API v1 — resource-first routes (see outliner_api_restructure_summary.md)."""

from fastapi import APIRouter, Depends

from outliner.deps import require_outliner_access

from . import admin, assignments, comments, documents, reviews, segments, submissions

router = APIRouter(dependencies=[Depends(require_outliner_access)])
router.include_router(documents.router)
router.include_router(segments.router)
router.include_router(comments.router)
router.include_router(reviews.router)
router.include_router(assignments.router)
router.include_router(submissions.router)
router.include_router(admin.router)

__all__ = ["router"]
