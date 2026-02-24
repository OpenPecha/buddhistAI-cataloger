from functools import wraps
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)

def handle_exceptions(default_message="Something went wrong"):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except HTTPException:
                raise
            except Exception as e:
                logger.exception(e)
                raise HTTPException(
                    status_code=500,
                    detail=default_message
                )
        return wrapper
    return decorator