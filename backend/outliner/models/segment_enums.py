"""Segment label and status enums plus allowed status transitions."""
from enum import Enum as PyEnum


class SegmentStatus(str, PyEnum):
    UNCHECKED = "unchecked"
    CHECKED = "checked"
    APPROVED = "approved"
    REJECTED = "rejected"


class SegmentLabels(str, PyEnum):
    FRONT_MATTER = "front matter"
    TOC = "TOC"
    TEXT = "text"
    BACK_MATTER = "back matter"


SEGMENT_STATUS_TRANSITIONS = {
    SegmentStatus.UNCHECKED: {SegmentStatus.CHECKED},
    SegmentStatus.CHECKED: {
        SegmentStatus.APPROVED,
        SegmentStatus.REJECTED,
        SegmentStatus.UNCHECKED,
    },
    SegmentStatus.REJECTED: {SegmentStatus.CHECKED},
    SegmentStatus.APPROVED: {SegmentStatus.UNCHECKED, SegmentStatus.CHECKED},
}
