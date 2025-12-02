from fastapi import FastAPI
from app.db.session import db_client
from app.api.router import api_router
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Stock Flow Hub API",
    description="Backend for the Inventory Management System.",
    version="1.0.0"
)

# --- SECURITY FIX: Strict Origins ---
# Only allow specific domains to talk to the backend.
origins = [
    "http://localhost:8080",      # Your local frontend
    "http://127.0.0.1:8080",      # Localhost IP variant
    # "https://your-production-domain.com", # Add your live domain here later
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,        
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"], # Explicit methods
    allow_headers=["*"],          # Headers are usually safe to keep open for auth/content-type
)

@app.on_event("startup")
async def startup():
    await db_client.connect()

@app.on_event("shutdown")
async def shutdown():
    await db_client.disconnect()

@app.get("/")
async def read_root():
    return {"message": "Welcome to the Stock Flow Hub API"}

app.include_router(api_router)