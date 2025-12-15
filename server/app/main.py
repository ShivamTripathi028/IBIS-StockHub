from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler

# Import your sync function
from app.services.amazon_sync import sync_amazon_orders

# Import the router (aliased correctly)
from app.api.router import api_router as router 
from app.db.session import db_client

# --- LIFESPAN MANAGER ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Start Database
    await db_client.connect()
    
    # 2. Start Scheduler
    scheduler = AsyncIOScheduler()
    scheduler.add_job(sync_amazon_orders, 'date')           # Run once now
    scheduler.add_job(sync_amazon_orders, 'interval', minutes=10) # Run every 10 mins
    scheduler.start()
    print("⏰ [Scheduler] Amazon Sync started (Runs every 10 mins)")
    
    yield
    
    # 3. Shutdown
    print("🛑 [Scheduler] Shutting down...")
    scheduler.shutdown()
    await db_client.disconnect()

# --- APP INITIALIZATION ---
app = FastAPI(title="StockHub API", version="1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- FIX IS HERE: No prefix needed (router.py already has it) ---
app.include_router(router)

@app.get("/")
def read_root():
    return {"message": "StockHub Server is Running 🚀"}