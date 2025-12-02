from fastapi import APIRouter, Depends
from typing import List
from prisma import Prisma
from app.db.session import db_client
from . import service
from .schemas import DashboardStats, LowStockItem

router = APIRouter()

@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(db: Prisma = Depends(lambda: db_client)):
    return await service.get_stats(db)

@router.get("/low-stock", response_model=List[LowStockItem])
async def get_low_stock_list(db: Prisma = Depends(lambda: db_client)):
    return await service.get_low_stock_items(db)