


from bdrc.volume import get_volume, get_volumes


async def get_new_volume():
    volume = await get_volumes(status="active",limit=1)
    # merge the volume text and load in database
    volume_item=volume["items"][0]
    repo_id = volume_item["rep_id"]
    volume_id = volume_item["vol_id"]
    volume_data = await get_volume(repo_id, volume_id)
    return volume_data