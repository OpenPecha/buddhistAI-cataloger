


from bdrc.volume import STATUS, get_volume, get_volumes, update_volume_status
from dotenv import load_dotenv
import os
load_dotenv(override=True)
BATCH_ID=os.getenv("OUTLINER_BATCH_ID") or "1"

async def get_new_volume():
    volume = await get_volumes(status="active",limit=1,batch_id=BATCH_ID)
    # merge the volume text and load in database
    if len(volume["items"]) == 0:
        return None
    volume_item=volume["items"][0]
    volume_id = volume_item["id"]
    volume_data = await get_volume(volume_id)
    return volume_data

async def update_volume_status(volume_id: str, status: STATUS):
    await update_volume_status(volume_id, status)