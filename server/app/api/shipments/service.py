from prisma import Prisma
from datetime import datetime
from prisma.enums import ShipmentStatus, OrderStatus, OrderSource
from .schemas import ShipmentRequestCreate, ShipmentCreate, ShipmentRequestBatchCreate
import pandas as pd
import io

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
    async with db.tx() as transaction:
        results = []
        for item in batch_data.items:
            existing_request = await transaction.shipmentrequest.find_first(
                where={
                    'shipmentId': shipment_id,
                    'productId': item.product_id,
                    'customerName': batch_data.customer_name if batch_data.customer_name else None
                }
            )

            if existing_request:
                updated = await transaction.shipmentrequest.update(
                    where={'id': existing_request.id},
                    data={'quantity': {'increment': item.quantity}}
                )
                results.append(updated)
            else:
                created = await transaction.shipmentrequest.create(
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
    """
    Updates status. 
    - PLANNING -> ORDERED: Generates Sales Orders ONLY for items with a Customer Name.
    - ORDERED -> RECEIVED: Adds stock. If it was a Pre-Order, reserves it immediately.
    """
    shipment = await db.shipment.find_unique(where={'id': shipment_id}, include={'requests': True})
    
    if not shipment:
        return None 

    # 1. RECEIVING STOCK
    if new_status == ShipmentStatus.RECEIVED and shipment.status == ShipmentStatus.ORDERED:
        async with db.tx() as transaction:
            for request in shipment.requests:
                # A. ALWAYS Add to global inventory first (Replenishment)
                await transaction.product.update(
                    where={'id': request.productId},
                    data={'quantityInStock': {'increment': request.quantity}}
                )
            
                # B. IF it was a Pre-Order (Linked to an Order ID), Reserve it immediately.
                # If 'fulfillingOrderId' is None (General Stock), this block is SKIPPED.
                if request.fulfillingOrderId:
                    # 1. Deduct Stock (Reserve it for the customer)
                    await transaction.product.update(
                        where={'id': request.productId},
                        data={'quantityInStock': {'decrement': request.quantity}}
                    )
                    
                    # 2. Update the Linked Sales Order Status
                    await transaction.order.update(
                        where={'id': request.fulfillingOrderId},
                        data={'status': OrderStatus.READY_TO_SHIP}
                    )

            updated_shipment = await transaction.shipment.update(
                where={'id': shipment_id},
                data={'status': new_status, 'receivedAt': datetime.now()}
            )
            return updated_shipment

    # 2. MARKING AS ORDERED
    elif new_status == ShipmentStatus.ORDERED and shipment.status == ShipmentStatus.PLANNING:
        async with db.tx() as transaction:
            # A. Update Shipment Status
            updated_shipment = await transaction.shipment.update(
                where={'id': shipment_id},
                data={'status': new_status, 'orderedAt': datetime.now()}
            )

            # B. Group Requests by Customer
            customer_groups = {}
            for req in shipment.requests:
                # --- CRITICAL CHECK ---
                # If customerName is None or Empty, ignore it for Sales Order creation.
                # It stays as a ShipmentRequest but won't trigger an Order.
                if req.customerName and req.customerName.strip():
                    if req.customerName not in customer_groups:
                        customer_groups[req.customerName] = []
                    customer_groups[req.customerName].append(req)
            
            # C. Create Orders (Only for named customers)
            for cust_name, requests in customer_groups.items():
                new_order = await transaction.order.create(
                    data={
                        'customerName': cust_name,
                        'source': OrderSource.PreOrder,
                        'status': OrderStatus.AWAITING_STOCK
                    }
                )

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

# ... (rest of the file: delete_request, update_request_quantity, get_invoice_data, generate_excel_invoice)
async def delete_request(db: Prisma, request_id: str):
    request = await db.shipmentrequest.find_unique(
        where={'id': request_id},
        include={'shipment': True}
    )
    if not request: return None
    if request.shipment.status != ShipmentStatus.PLANNING:
        raise ValueError("Cannot delete items from a shipment that is not in PLANNING stage.")
    return await db.shipmentrequest.delete(where={'id': request_id})

async def update_request_quantity(db: Prisma, request_id: str, quantity: int):
    request = await db.shipmentrequest.find_unique(
        where={'id': request_id},
        include={'shipment': True}
    )
    if not request: return None
    if request.shipment.status != ShipmentStatus.PLANNING:
        raise ValueError("Cannot update items in a shipment that is not in PLANNING stage.")
    return await db.shipmentrequest.update(
        where={'id': request_id},
        data={'quantity': quantity}
    )

async def get_invoice_data(db: Prisma, shipment_id: str):
    shipment = await db.shipment.find_unique(
        where={'id': shipment_id},
        include={'requests': {'include': {'product': True}}}
    )
    if not shipment: return None

    aggregated = {}
    for req in shipment.requests:
        sku = req.product.sku
        if sku in aggregated:
            aggregated[sku]['qty'] += req.quantity
        else:
            aggregated[sku] = {'name': req.product.name, 'qty': req.quantity}

    items = []
    for sku, data in aggregated.items():
        items.append({'sku': sku, 'product_name': data['name'], 'total_quantity': data['qty']})
    
    items.sort(key=lambda x: x['sku'])

    return {
        'shipment_name': shipment.name,
        'items': items,
        'total_items': sum(item['total_quantity'] for item in items)
    }

async def generate_excel_invoice(db: Prisma, shipment_id: str):
    data = await get_invoice_data(db, shipment_id)
    if not data: return None

    df = pd.DataFrame(data['items'])
    df.rename(columns={'sku': 'SKU', 'product_name': 'Product Name', 'total_quantity': 'Quantity'}, inplace=True)

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Invoice')
        worksheet = writer.sheets['Invoice']
        worksheet.column_dimensions['A'].width = 15
        worksheet.column_dimensions['B'].width = 50
        worksheet.column_dimensions['C'].width = 10
    
    output.seek(0)
    return output, data['shipment_name']