from fastapi import APIRouter

from cataloger.controller.openpecha_api.roles import get_roles

router = APIRouter()


@router.get("/roles")
async def roles():
    return get_roles()
