from fastapi import APIRouter, Depends, Query, HTTPException
from typing import List
from prisma import Prisma
from prisma.enums import OrderStatus
from app.db.session import db_client
from . import service
from .schemas import Order, OrderCreate

router = APIRouter()

@router.post("/", response_model=Order, status_code=201)
async def create_new_order(
    order_data: OrderCreate,
    db: Prisma = Depends(lambda: db_client)
):
    """
    Create a new order for a local or Amazon sale.
    """
    return await service.create(db, order_data)

@router.get("/", response_model=List[Order])
async def get_all_orders_route(
    status: OrderStatus | None = Query(None), # Handles ?status=... from the URL
    db: Prisma = Depends(lambda: db_client)
):
    """
    Get a list of all orders, optionally filtered by status.
    """
    # The service returns lineItems, but the frontend expects 'products'. We rename it here.
    orders_from_db = await service.get_all(db, status)
    for order in orders_from_db:
        order.products = order.lineItems
    return orders_from_db

@router.post("/{order_id}/complete", response_model=Order)
async def complete_order_route(order_id: str, db: Prisma = Depends(lambda: db_client)):
    """Mark an order as completed and reduce inventory."""
    try:
        updated_order = await service.complete_order(db, order_id)
        if not updated_order:
            raise HTTPException(status_code=404, detail="Order not found")
        updated_order.products = updated_order.lineItems
        return updated_order
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{order_id}/cancel", response_model=Order)
async def cancel_order_route(order_id: str, db: Prisma = Depends(lambda: db_client)):
    """Cancel an order."""
    updated_order = await service.cancel_order(db, order_id)
    if not updated_order:
        raise HTTPException(status_code=404, detail="Order not found")
    updated_order.products = updated_order.lineItems
    return updated_order


@router.post("/{order_id}/hold", response_model=Order)
async def hold_order_route(order_id: str, db: Prisma = Depends(lambda: db_client)):
    """Put an order on hold."""
    updated_order = await service.hold_order(db, order_id)
    if not updated_order:
        raise HTTPException(status_code=404, detail="Order not found")
    updated_order.products = updated_order.lineItems
    return updated_order