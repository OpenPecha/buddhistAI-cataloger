"""Outliner segment controller — facade over split modules (CRUD, bulk, split/merge)."""

from outliner.controller.segment_bulk_ops import bulk_segment_operations, update_segments_bulk
from outliner.controller.segment_common import (
    _segment_orms_from_bulk_data,
    segment_to_response_dict ,
)
from outliner.controller.segment_crud import (
    create_segment,
    create_segments_bulk,
    delete_segment,
    get_segment,
    list_segments,
    update_segment,
    update_segment_status,
)
from outliner.controller.segment_split_merge import merge_segments, split_segment
