


from bdrc.volume import STATUS, get_volume, get_volumes, update_volume_status
from core.database import SessionLocal
from outliner.models.active_batch import ActiveBatch


def _get_active_batch_id() -> str | None:
    db = SessionLocal()
    try:
        row = db.query(ActiveBatch).order_by(ActiveBatch.id).first()
        return str(row.batch_id) if row else None
    finally:
        db.close()

async def get_new_volume():
    batch_id = _get_active_batch_id()
    if not batch_id:
        return None

    volume = await get_volumes(status="active", limit=1, batch_id=batch_id)
    if len(volume["items"]) == 0:
        return None

    volume_item = volume["items"][0]
    volume_id = volume_item["id"]
    volume_data = await get_volume(volume_id)
    return volume_data
        
        
        
        

async def update_volume_status(volume_id: str, status: STATUS):
    await update_volume_status(volume_id, status)