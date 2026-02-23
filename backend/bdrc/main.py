


from bdrc.volume import get_volume, get_volumes


async def get_new_volume():
    volume = await get_volumes(status="new",limit=1)
    # merge the volume text and load in database
    volume_item=volume["items"][0]
    work_id = volume_item["w_id"]
    instance_id = volume_item["i_id"]
    volume_data = await get_volume(work_id, instance_id)
    return volume_data