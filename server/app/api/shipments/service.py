from prisma import Prisma
from datetime import datetime
from prisma.enums import ShipmentStatus
from .schemas import ShipmentRequestCreate 

async def get_all(db: Prisma):
    """Returns all shipments from the database, ordered by most recent."""
    return await db.shipment.find_many(order={'createdAt': 'desc'})

async def get_by_id(db: Prisma, shipment_id: str):
    """
    Returns a single shipment by its ID, including its related requests and products.
    """
    return await db.shipment.find_unique(
        where={'id': shipment_id},
        include={
            'requests': {
                'include': {
                    'product': True # Include product details for each request
                }
            }
        }
    )

async def create(db: Prisma):
    """Creates a new shipment with an automatically generated name."""
    current_date = datetime.now().strftime("%B %d, %Y")
    base_name = f"Shipment - {current_date}"
    shipment_name = base_name
    
    count = 0
    while await db.shipment.find_first(where={'name': shipment_name}):
        count += 1
        shipment_name = f"{base_name} (#{count})"

    return await db.shipment.create(data={'name': shipment_name})

async def add_request_to_shipment(db: Prisma, shipment_id: str, request_data: ShipmentRequestCreate):
    """
    Creates a new ShipmentRequest and links it to an existing shipment and product.
    """
    return await db.shipmentrequest.create(
        data={
            'shipmentId': shipment_id,
            'productId': request_data.product_id,
            'quantity': request_data.quantity,
            'customerName': request_data.customer_name,
        }
    )

async def update_status(db: Prisma, shipment_id: str, new_status: ShipmentStatus):
    """
    Updates the status of a shipment. If the new status is 'RECEIVED',
    it increments the stock for all products in the shipment within a transaction.
    """
    shipment = await db.shipment.find_unique(where={'id': shipment_id}, include={'requests': True})
    
    if not shipment:
        return None # Shipment not found

    # Logic for when stock is received
    if new_status == ShipmentStatus.RECEIVED and shipment.status == ShipmentStatus.ORDERED:
        async with db.tx() as transaction:
            # 1. Increment stock for each product in the shipment
            for request in shipment.requests:
                await transaction.product.update(
                    where={'id': request.productId},
                    data={'quantityInStock': {'increment': request.quantity}}
                )
            
            # 2. Update the shipment status and received date
            updated_shipment = await transaction.shipment.update(
                where={'id': shipment_id},
                data={'status': new_status, 'receivedAt': datetime.now()}
            )
            return updated_shipment

    # Logic for marking as ordered
    elif new_status == ShipmentStatus.ORDERED and shipment.status == ShipmentStatus.PLANNING:
        return await db.shipment.update(
            where={'id': shipment_id},
            data={'status': new_status, 'orderedAt': datetime.now()}
        )
    
    # If the status transition is not valid, just return the original shipment
    return shipment