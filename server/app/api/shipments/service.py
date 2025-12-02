import pandas as pd
import io
from prisma import Prisma
from datetime import datetime
from prisma.enums import ShipmentStatus, OrderStatus, OrderSource
from .schemas import ShipmentRequestCreate, ShipmentCreate, ShipmentRequestBatchCreate

# ... (keep get_all, get_by_id, create, delete_shipment as they are) ...
async def get_all(db: Prisma):
    return await db.shipment.find_many(order={'createdAt': 'desc'})

async def get_by_id(db: Prisma, shipment_id: str):
    return await db.shipment.find_unique(
        where={'id': shipment_id},
        include={
            'requests': {
                'include': {
                    'product': True 
                }
            }
        }
    )

async def create(db: Prisma, shipment_data: ShipmentCreate):
    return await db.shipment.create(data={'name': shipment_data.name})

async def delete_shipment(db: Prisma, shipment_id: str):
    shipment = await db.shipment.find_unique(where={'id': shipment_id})
    if not shipment: return None
    if shipment.status != ShipmentStatus.PLANNING:
        raise ValueError("Only shipments in PLANNING status can be deleted.")
    return await db.shipment.delete(where={'id': shipment_id})

async def add_request_to_shipment(db: Prisma, shipment_id: str, request_data: ShipmentRequestCreate):
    return await db.shipmentrequest.create(
        data={
            'shipmentId': shipment_id,
            'productId': request_data.product_id,
            'quantity': request_data.quantity,
            'customerName': request_data.customer_name,
        }
    )

async def add_batch_requests(db: Prisma, shipment_id: str, batch_data: ShipmentRequestBatchCreate):
    """
    Adds multiple requests. If a request for the same product and customer exists,
    it increments the quantity instead of creating a duplicate.
    """
    results = []
    
    # We loop through items sequentially
    for item in batch_data.items:
        # 1. Check if this product/customer combo already exists in this shipment
        existing_request = await db.shipmentrequest.find_first(
            where={
                'shipmentId': shipment_id,
                'productId': item.product_id,
                # We handle NULL vs String comparison for customerName
                'customerName': batch_data.customer_name if batch_data.customer_name else None
            }
        )

        if existing_request:
            # 2. Update existing entry (Merge)
            updated = await db.shipmentrequest.update(
                where={'id': existing_request.id},
                data={
                    'quantity': {
                        'increment': item.quantity
                    }
                }
            )
            results.append(updated)
        else:
            # 3. Create new entry
            created = await db.shipmentrequest.create(
                data={
                    'shipmentId': shipment_id,
                    'productId': item.product_id,
                    'quantity': item.quantity,
                    'customerName': batch_data.customer_name,
                }
            )
            results.append(created)
            
    return results

async def update_status(db: Prisma, shipment_id: str, new_status: ShipmentStatus):
    shipment = await db.shipment.find_unique(where={'id': shipment_id}, include={'requests': True})
    
    if not shipment:
        return None 

    # 1. RECEIVING STOCK (Increment Inventory)
    if new_status == ShipmentStatus.RECEIVED and shipment.status == ShipmentStatus.ORDERED:
        async with db.tx() as transaction:
            for request in shipment.requests:
                await transaction.product.update(
                    where={'id': request.productId},
                    data={'quantityInStock': {'increment': request.quantity}}
                )
            
            # Also mark the associated Sales Orders as Ready to Ship
            for request in shipment.requests:
                if request.fulfillingOrderId:
                    await transaction.order.update(
                        where={'id': request.fulfillingOrderId},
                        data={'status': OrderStatus.READY_TO_SHIP}
                    )

            updated_shipment = await transaction.shipment.update(
                where={'id': shipment_id},
                data={'status': new_status, 'receivedAt': datetime.now()}
            )
            return updated_shipment

    # 2. MARKING AS ORDERED (Create Sales Orders)
    elif new_status == ShipmentStatus.ORDERED and shipment.status == ShipmentStatus.PLANNING:
        async with db.tx() as transaction:
            # A. Update Shipment Status
            updated_shipment = await transaction.shipment.update(
                where={'id': shipment_id},
                data={'status': new_status, 'orderedAt': datetime.now()}
            )

            # B. Group Requests by Customer
            # { "Shivam": [Request1, Request2] }
            customer_groups = {}
            for req in shipment.requests:
                if req.customerName: 
                    if req.customerName not in customer_groups:
                        customer_groups[req.customerName] = []
                    customer_groups[req.customerName].append(req)
            
            # C. Create Orders
            for cust_name, requests in customer_groups.items():
                # 1. Create the Order
                new_order = await transaction.order.create(
                    data={
                        'customerName': cust_name,
                        'source': OrderSource.PreOrder,
                        'status': OrderStatus.AWAITING_STOCK
                    }
                )

                # 2. Add Line Items & Link Requests
                for req in requests:
                    await transaction.orderlineitem.create(
                        data={
                            'orderId': new_order.id,
                            'productId': req.productId,
                            'quantity': req.quantity
                        }
                    )
                    
                    # Link the shipment request to this order
                    await transaction.shipmentrequest.update(
                        where={'id': req.id},
                        data={'fulfillingOrderId': new_order.id}
                    )
            
            return updated_shipment
    
    return shipment

async def delete_request(db: Prisma, request_id: str):
    """
    Deletes a specific request item. 
    Verifies that the parent shipment is still in PLANNING.
    """
    # 1. Find the request and include shipment to check status
    request = await db.shipmentrequest.find_unique(
        where={'id': request_id},
        include={'shipment': True}
    )
    
    if not request:
        return None
        
    if request.shipment.status != ShipmentStatus.PLANNING:
        raise ValueError("Cannot delete items from a shipment that is not in PLANNING stage.")

    # 2. Delete
    return await db.shipmentrequest.delete(where={'id': request_id})

async def update_request_quantity(db: Prisma, request_id: str, quantity: int):
    """
    Updates the quantity of a request item.
    Verifies status is PLANNING.
    """
    request = await db.shipmentrequest.find_unique(
        where={'id': request_id},
        include={'shipment': True}
    )
    
    if not request:
        return None
        
    if request.shipment.status != ShipmentStatus.PLANNING:
        raise ValueError("Cannot update items in a shipment that is not in PLANNING stage.")

    return await db.shipmentrequest.update(
        where={'id': request_id},
        data={'quantity': quantity}
    )

async def get_invoice_data(db: Prisma, shipment_id: str):
    """
    Aggregates shipment requests by Product SKU.
    Returns structured data for preview.
    """
    shipment = await db.shipment.find_unique(
        where={'id': shipment_id},
        include={
            'requests': {
                'include': {'product': True}
            }
        }
    )
    
    if not shipment:
        return None

    # Aggregation Logic
    aggregated = {} # Key: sku, Value: {name, qty}

    for req in shipment.requests:
        sku = req.product.sku
        if sku in aggregated:
            aggregated[sku]['qty'] += req.quantity
        else:
            aggregated[sku] = {
                'name': req.product.name,
                'qty': req.quantity
            }

    # Convert to list
    items = []
    for sku, data in aggregated.items():
        items.append({
            'sku': sku,
            'product_name': data['name'],
            'total_quantity': data['qty']
        })
    
    # Sort by SKU
    items.sort(key=lambda x: x['sku'])

    return {
        'shipment_name': shipment.name,
        'items': items,
        'total_items': sum(item['total_quantity'] for item in items)
    }

async def generate_excel_invoice(db: Prisma, shipment_id: str):
    """
    Generates an Excel file bytes object.
    """
    data = await get_invoice_data(db, shipment_id)
    if not data:
        return None

    # Create DataFrame
    df = pd.DataFrame(data['items'])
    
    # Rename columns for the Excel file
    df.rename(columns={
        'sku': 'SKU', 
        'product_name': 'Product Name', 
        'total_quantity': 'Quantity'
    }, inplace=True)

    # Write to BytesIO buffer
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Invoice')
        
        # Adjust column widths (optional polish)
        worksheet = writer.sheets['Invoice']
        worksheet.column_dimensions['A'].width = 15
        worksheet.column_dimensions['B'].width = 50
        worksheet.column_dimensions['C'].width = 10
    
    output.seek(0)
    return output, data['shipment_name']