from fastapi import APIRouter, Depends, HTTPException
from typing import List
from prisma import Prisma
from app.db.session import db_client
from . import service
from .schemas import (
    ShipmentListItem, 
    ShipmentDetail, 
    ShipmentStatusUpdate, 
    ShipmentRequestCreate, 
    ShipmentCreate,
    ShipmentRequestBatchCreate,
    ShipmentRequestUpdate
)

router = APIRouter()

@router.post("", response_model=ShipmentListItem, status_code=201)
async def create_new_shipment(shipment_data: ShipmentCreate, db: Prisma = Depends(lambda: db_client)):
    return await service.create(db, shipment_data)

@router.delete("/{shipment_id}", status_code=204)
async def delete_shipment_route(shipment_id: str, db: Prisma = Depends(lambda: db_client)):
    try:
        result = await service.delete_shipment(db, shipment_id)
        if result is None: raise HTTPException(status_code=404, detail="Shipment not found")
    except ValueError as e: raise HTTPException(status_code=400, detail=str(e))
    return None

@router.get("", response_model=List[ShipmentListItem])
async def get_all_shipments_route(db: Prisma = Depends(lambda: db_client)):
    return await service.get_all(db)

@router.get("/{shipment_id}", response_model=ShipmentDetail)
async def get_shipment_details(shipment_id: str, db: Prisma = Depends(lambda: db_client)):
    shipment = await service.get_by_id(db, shipment_id)
    if not shipment: raise HTTPException(status_code=404, detail="Shipment not found")
    return shipment

@router.post("/{shipment_id}/requests", response_model=ShipmentDetail)
async def add_request_to_shipment_route(
    shipment_id: str,
    request_data: ShipmentRequestCreate,
    db: Prisma = Depends(lambda: db_client)
):
    shipment = await service.get_by_id(db, shipment_id)
    if not shipment: raise HTTPException(status_code=404, detail="Shipment not found")
    if str(shipment.status) != "PLANNING": 
        raise HTTPException(status_code=400, detail=f"Cannot add requests to a shipment with status '{shipment.status}'")

    await service.add_request_to_shipment(db, shipment_id, request_data)
    return await service.get_by_id(db, shipment_id)

@router.post("/{shipment_id}/requests/batch", response_model=ShipmentDetail)
async def add_batch_requests_route(
    shipment_id: str,
    batch_data: ShipmentRequestBatchCreate,
    db: Prisma = Depends(lambda: db_client)
):
    """Add multiple requests at once."""
    shipment = await service.get_by_id(db, shipment_id)
    if not shipment: raise HTTPException(status_code=404, detail="Shipment not found")
    if str(shipment.status) != "PLANNING": 
        raise HTTPException(status_code=400, detail=f"Cannot add requests to a shipment with status '{shipment.status}'")

    await service.add_batch_requests(db, shipment_id, batch_data)
    # Return updated shipment details
    return await service.get_by_id(db, shipment_id)

@router.put("/{shipment_id}/status", response_model=ShipmentDetail)
async def update_shipment_status_route(
    shipment_id: str,
    status_update: ShipmentStatusUpdate,
    db: Prisma = Depends(lambda: db_client)
):
    updated_shipment = await service.update_status(db, shipment_id, status_update.status)
    if not updated_shipment: raise HTTPException(status_code=404, detail="Shipment not found")
    return await service.get_by_id(db, shipment_id)

@router.delete("/requests/{request_id}", status_code=204)
async def delete_request_item(request_id: str, db: Prisma = Depends(lambda: db_client)):
    try:
        result = await service.delete_request(db, request_id)
        if result is None:
            raise HTTPException(status_code=404, detail="Request item not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return None

@router.patch("/requests/{request_id}")
async def update_request_item(
    request_id: str, 
    update_data: ShipmentRequestUpdate,
    db: Prisma = Depends(lambda: db_client)
):
    try:
        result = await service.update_request_quantity(db, request_id, update_data.quantity)
        if result is None:
            raise HTTPException(status_code=404, detail="Request item not found")
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))