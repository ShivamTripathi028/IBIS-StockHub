from fastapi import APIRouter, Depends
from typing import List
from prisma import Prisma
from app.db.session import db_client
from . import service
from .schemas import InventoryItem

router = APIRouter()

@router.get("", response_model=List[InventoryItem])
async def get_inventory_list(db: Prisma = Depends(lambda: db_client)):
    """
    Get a list of all items in inventory.
    This provides the real-time stock levels for all products.
    """
    return await service.get_all_inventory_items(db)