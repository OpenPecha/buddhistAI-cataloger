"""Re-export enum OpenPecha client for backward compatibility."""

from cataloger.controller.openpecha_api import enums


def get_enum(type: str):
    return enums.get_enum(type)
