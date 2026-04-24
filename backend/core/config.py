import os
from dotenv import load_dotenv

load_dotenv(override=True)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    ""
)

# BEC OpenPecha / OT API (volume batch aggregates for admin dashboard)
BEC_OTAPI_BASE_URL = os.getenv("BEC_OTAPI_BASE_URL", "https://bec-otapi.bdrc.io").rstrip("/")
