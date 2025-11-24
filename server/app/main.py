from fastapi import FastAPI
from app.db.session import db_client
from app.api.router import api_router
from fastapi.middleware.cors import CORSMiddleware

# Create the FastAPI app instance
app = FastAPI(
    title="Stock Flow Hub API",
    description="Backend for the Inventory Management System.",
    version="1.0.0"
)

origins = [
    "http://localhost:8080",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"], 
)

@app.on_event("startup")
async def startup():
    # Connect to the database
    await db_client.connect()

@app.on_event("shutdown")
async def shutdown():
    # Disconnect from the database
    await db_client.disconnect()

# A simple root endpoint
@app.get("/")
async def read_root():
    return {"message": "Welcome to the Stock Flow Hub API"}

# Include the main API router
app.include_router(api_router)