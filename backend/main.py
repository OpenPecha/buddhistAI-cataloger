import sys
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
import uvicorn
from routers import person, text, translation, annotation, bdrc, category, enum, tokenize, aligner_data
from dotenv import load_dotenv
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.middleware.base import BaseHTTPMiddleware

from mangum import Mangum

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
            "url": "https://api.buddhistai.tools",
            "description": "Production server"
        }
    ]
)


class PayloadSizeIncrease(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Only needed for routes that use form()/UploadFile via form-data
        await request.form(max_part_size=50 * 1024 * 1024)  # 50 MB
        return await call_next(request)

app.add_middleware(PayloadSizeIncrease)
# Add this middleware BEFORE CORS middleware


# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(person.router, prefix="/person", tags=["person"])
app.include_router(text.router, prefix="/text", tags=["text"])
app.include_router(bdrc.router, prefix="/bdrc", tags=["bdrc"])
app.include_router(translation.router, prefix="/instances", tags=["translation"])
app.include_router(annotation.router, prefix="/v2/annotations", tags=["annotation"])
app.include_router(category.router, prefix="/v2/categories", tags=["category"])
app.include_router(enum.router, prefix="/v2/enum", tags=["enum"])
app.include_router(tokenize.router, prefix="/tokenize", tags=["tokenize"])
app.include_router(aligner_data.router, prefix="/aligner-data", tags=["aligner-data"])

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
        timeout_keep_alive=600
    )



handler = Mangum(app)