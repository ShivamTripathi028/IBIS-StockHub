from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler

# Import your sync function
from app.services.amazon_sync import sync_amazon_orders

# --- FIX IS HERE: Import 'api_router' and alias it as 'router' ---
from app.api.router import api_router as router 
from app.db.session import db_client

# --- LIFESPAN MANAGER (Starts/Stops Scheduler) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Start Database
    await db_client.connect()
    
    # 2. Start Scheduler
    scheduler = AsyncIOScheduler()
    
    # Run sync immediately on startup (optional, good for testing)
    scheduler.add_job(sync_amazon_orders, 'date') 
    
    # Run sync every 10 minutes forever
    scheduler.add_job(sync_amazon_orders, 'interval', minutes=10)
    
    scheduler.start()
    print("⏰ [Scheduler] Amazon Sync started (Runs every 10 mins)")
    
    yield
    
    # 3. Shutdown
    print("🛑 [Scheduler] Shutting down...")
    scheduler.shutdown()
    await db_client.disconnect()

# --- APP INITIALIZATION ---
app = FastAPI(title="StockHub API", version="1.0", lifespan=lifespan)

# CORS (Allow Frontend to connect)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include your API Routes
app.include_router(router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "StockHub Server is Running 🚀"}