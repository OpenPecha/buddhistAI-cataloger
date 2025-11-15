import sys
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
import uvicorn
from routers import person, text, translation, annotation, bdrc, category
from dotenv import load_dotenv
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
# Add project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

load_dotenv( override=True)

app = FastAPI(
    title="OpenPecha Text API",
    version="1.0.0",
    description="API for managing OpenPecha texts and persons",
    servers=[
        {
            "url": "http://localhost:8000",
            "description": "Development server"
        },
        {
            "url": os.getenv("API_ENDPOINT"),
            "description": "Production server"
        }
    ]
)

# Add this middleware BEFORE CORS middleware
@app.middleware("http")
async def increase_max_request_size(request: Request, call_next):
    # Starlette's default max request body size is ~1MB
    # We need to allow larger bodies for instance creation with content
    return await call_next(request)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(person.router, prefix="/person", tags=["person"])
app.include_router(text.router, prefix="/text", tags=["text"])
app.include_router(bdrc.router, prefix="/bdrc", tags=["bdrc"])
app.include_router(translation.router, prefix="/instances", tags=["translation"])
app.include_router(annotation.router, prefix="/v2/annotations", tags=["annotation"])
app.include_router(category.router, prefix="/v2/categories", tags=["category"])

@app.get("/")
def read_root():
    return {"message": "Welcome to the FastAPI backend"}

if __name__ == "__main__":
    uvicorn.run(
        "main:app", 
        host="0.0.0.0", 
        port=int(os.getenv("PORT", 8000)), 
        reload=True,
        limit_max_requests=32*1024*1024,
    )