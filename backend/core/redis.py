import os
import json
from typing import Optional
from redis import Redis
from redis.exceptions import ConnectionError, TimeoutError
from dotenv import load_dotenv

load_dotenv(override=True)

# Redis configuration
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB = int(os.getenv("REDIS_DB", 0))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)
REDIS_URL = os.getenv("REDIS_URL", None)
EXPIRE_TIME = int(os.getenv("EXPIRE_TIME", 172800))
# Redis key prefix for document content
DOCUMENT_CONTENT_KEY_PREFIX = "outliner:document:content:"

# Initialize Redis client
try:
    if REDIS_URL:
        redis_client = Redis.from_url(REDIS_URL, decode_responses=True)
    else:
        redis_client = Redis(
            host=REDIS_HOST,
            port=REDIS_PORT,
            db=REDIS_DB,
            password=REDIS_PASSWORD,
            decode_responses=True
        )
    # Test connection
    redis_client.ping()
except (ConnectionError, TimeoutError) as e:
    print(f"Warning: Redis connection failed: {e}. Redis caching will be disabled.")
    redis_client = None


def get_document_content_from_cache(document_id: str) -> Optional[str]:
    """
    Get document content from Redis cache.
    
    Args:
        document_id: The document ID
        
    Returns:
        Document content if found in cache, None otherwise
    """
    if not redis_client:
        return None
    
    try:
        key = f"{DOCUMENT_CONTENT_KEY_PREFIX}{document_id}"
        content = redis_client.get(key)
        return content
    except Exception as e:
        print(f"Error reading from Redis cache: {e}")
        return None


def set_document_content_in_cache(document_id: str, content: str, ttl: int = EXPIRE_TIME) -> bool:
    """
    Store document content in Redis cache.
    
    Args:
        document_id: The document ID
        content: The document content to cache
        ttl: Time to live in seconds (default: 1 hour)
        
    Returns:
        True if successful, False otherwise
    """
    if not redis_client:
        return False
    
    try:
        key = f"{DOCUMENT_CONTENT_KEY_PREFIX}{document_id}"
        redis_client.setex(key, ttl, content)
        return True
    except Exception as e:
        print(f"Error writing to Redis cache: {e}")
        return False


def invalidate_document_content_cache(document_id: str) -> bool:
    """
    Invalidate (delete) document content from Redis cache.
    
    Args:
        document_id: The document ID
        
    Returns:
        True if successful, False otherwise
    """
    if not redis_client:
        return False
    
    try:
        key = f"{DOCUMENT_CONTENT_KEY_PREFIX}{document_id}"
        redis_client.delete(key)
        return True
    except Exception as e:
        print(f"Error deleting from Redis cache: {e}")
        return False


def is_redis_available() -> bool:
    """
    Check if Redis is available.
    
    Returns:
        True if Redis is available, False otherwise
    """
    return redis_client is not None
