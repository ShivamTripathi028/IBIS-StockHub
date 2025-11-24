from fastapi import APIRouter
from app.api.products.router import router as products_router
from app.api.shipments.router import router as shipments_router
from app.api.inventory.router import router as inventory_router
from app.api.orders.router import router as orders_router

api_router = APIRouter(prefix="/api")
api_router.include_router(products_router, prefix="/products", tags=["Products"])
api_router.include_router(shipments_router, prefix="/shipments", tags=["Shipments"])
api_router.include_router(inventory_router, prefix="/inventory", tags=["Inventory"])
api_router.include_router(orders_router, prefix="/orders", tags=["Orders"])