


from bdrc.volume import STATUS, get_volume, get_volumes, update_volume_status
from dotenv import load_dotenv
import os
load_dotenv(override=True)
BATCH_ID=os.getenv("OUTLINER_BATCH_ID") or "1"

async def get_new_volume():
    batch_id = BATCH_ID
    while True:
        volume = await get_volumes(status="active", limit=1, batch_id=batch_id)
        if len(volume["items"]) > 0:
            volume_item = volume["items"][0]
            volume_id = volume_item["id"]
            volume_data = await get_volume(volume_id)
            return volume_data
        # If no volumes found, increment batch_id up to "5"
        if str(batch_id).isdigit() and int(batch_id) < 5:
            batch_id = str(int(batch_id) + 1)
        else:
            return None

async def update_volume_status(volume_id: str, status: STATUS):
    await update_volume_status(volume_id, status)