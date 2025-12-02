from fastapi import APIRouter, Depends
from typing import List
from prisma import Prisma
from app.db.session import db_client
from . import service
from .schemas import InventoryItem

router = APIRouter()

@router.get("", response_model=List[InventoryItem])
async def get_inventory_list(db: Prisma = Depends(lambda: db_client)):
    return await service.get_all_inventory_items(db)

# --- NEW ENDPOINT ---
@router.post("/reset", status_code=204)
async def reset_inventory_route(db: Prisma = Depends(lambda: db_client)):
    """Development Endpoint: Clears all inventory stock."""
    await service.reset_inventory(db)
    return None