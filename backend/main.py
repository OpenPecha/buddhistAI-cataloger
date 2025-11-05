import sys
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from routers import person, text, translation
from dotenv import load_dotenv
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
app.include_router(translation.router, prefix="/instances", tags=["translation"])

@app.get("/")
def read_root():
    return {"message": "Welcome to the FastAPI backend"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT")), reload=True)
