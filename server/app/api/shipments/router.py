from fastapi import APIRouter, Depends, HTTPException
from typing import List
from prisma import Prisma
from app.db.session import db_client
from . import service
from .schemas import ShipmentListItem, ShipmentDetail, ShipmentStatusUpdate, ShipmentRequestCreate

router = APIRouter()

@router.post("/", response_model=ShipmentListItem, status_code=201)
async def create_new_shipment(db: Prisma = Depends(lambda: db_client)):
    """Create a new empty shipment."""
    return await service.create(db)

@router.get("/", response_model=List[ShipmentListItem])
async def get_all_shipments_route(db: Prisma = Depends(lambda: db_client)):
    """Get a list of all existing shipments."""
    return await service.get_all(db)

# --- NEW ENDPOINT for Shipment Detail page ---
@router.get("/{shipment_id}", response_model=ShipmentDetail)
async def get_shipment_details(shipment_id: str, db: Prisma = Depends(lambda: db_client)):
    """Retrieve details for a single shipment."""
    shipment = await service.get_by_id(db, shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    return shipment

@router.post("/{shipment_id}/requests", response_model=ShipmentDetail)
async def add_request_to_shipment_route(
    shipment_id: str,
    request_data: ShipmentRequestCreate,
    db: Prisma = Depends(lambda: db_client)
):
    """
    Add a new product request (line item) to a shipment.
    """
    # First, check if the shipment exists and is still in the planning phase
    shipment = await service.get_by_id(db, shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if shipment.status != ShipmentStatus.PLANNING:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot add requests to a shipment with status '{shipment.status}'"
        )

    # TODO: We should also verify the product_id exists. We'll add this validation later.

    await service.add_request_to_shipment(db, shipment_id, request_data)
    
    # Return the full, updated shipment details so the frontend can refresh its state
    return await service.get_by_id(db, shipment_id)


@router.put("/{shipment_id}/status", response_model=ShipmentDetail)
async def update_shipment_status_route(
    shipment_id: str,
    status_update: ShipmentStatusUpdate,
    db: Prisma = Depends(lambda: db_client)
):
    updated_shipment = await service.update_status(db, shipment_id, status_update.status)
    if not updated_shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    return await service.get_by_id(db, shipment_id)