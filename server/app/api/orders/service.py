from prisma import Prisma
from prisma.enums import OrderStatus, OrderSource
from .schemas import OrderCreate
from fastapi import HTTPException
from datetime import datetime, timedelta # Added timedelta

# --- NEW FUNCTION: Cleanup Logic ---
async def cleanup_old_cancelled_orders(db: Prisma):
    """
    Deletes orders that have been CANCELLED for more than 3 days.
    Uses 'updatedAt' which represents the time the status was changed to CANCELLED.
    """
    three_days_ago = datetime.now() - timedelta(days=3)
    
    await db.order.delete_many(
        where={
            'status': OrderStatus.CANCELLED,
            'updatedAt': {'lt': three_days_ago}
        }
    )

async def get_all(db: Prisma, status: OrderStatus | None = None):
    # 1. Run the cleanup before fetching
    await cleanup_old_cancelled_orders(db)

    # 2. Fetch the clean list
    query = {}
    if status:
        query['where'] = {'status': status}
    
    return await db.order.find_many(
        include={'lineItems': {'include': {'product': True}}},
        order={'createdAt': 'desc'},
        **query
    )

async def get_by_id(db: Prisma, order_id: str):
    return await db.order.find_unique(
        where={'id': order_id},
        include={'lineItems': {'include': {'product': True}}}
    )

async def create(db: Prisma, order_data: OrderCreate):
    async with db.tx() as transaction:
        # 1. Validation & Deduction Loop
        for item in order_data.line_items:
            product = await transaction.product.find_unique(where={'id': item.product_id})
            
            if not product:
                raise ValueError(f"Product {item.product_id} not found")
            
            if product.quantityInStock < item.quantity:
                raise ValueError(f"Insufficient stock for {product.name}. Available: {product.quantityInStock}, Requested: {item.quantity}")

            # Deduct Stock
            await transaction.product.update(
                where={'id': item.product_id},
                data={'quantityInStock': {'decrement': item.quantity}}
            )

        # 2. Create Order
        new_order = await transaction.order.create(
            data={
                'customerName': order_data.customer_name,
                'source': order_data.source,
                'status': OrderStatus.READY_TO_SHIP
            }
        )

        # 3. Create Line Items
        for item in order_data.line_items:
            await transaction.orderlineitem.create(
                data={
                    'orderId': new_order.id,
                    'productId': item.product_id,
                    'quantity': item.quantity
                }
            )
            
    return await get_by_id(db, new_order.id)

async def complete_order(db: Prisma, order_id: str):
    order = await get_by_id(db, order_id)
    if not order: return None
    
    if order.status != OrderStatus.READY_TO_SHIP:
        raise ValueError("Order must be Ready to Ship to complete.")

    return await db.order.update(
        where={'id': order_id},
        data={'status': OrderStatus.COMPLETED},
        include={'lineItems': {'include': {'product': True}}}
    )

async def cancel_order(db: Prisma, order_id: str):
    order = await get_by_id(db, order_id)
    if not order: return None

    async with db.tx() as transaction:
        # Return stock if it was reserved
        if order.status == OrderStatus.READY_TO_SHIP:
            for item in order.lineItems:
                await transaction.product.update(
                    where={'id': item.productId},
                    data={'quantityInStock': {'increment': item.quantity}}
                )
        
        updated_order = await transaction.order.update(
            where={'id': order_id},
            data={'status': OrderStatus.CANCELLED},
            include={'lineItems': {'include': {'product': True}}}
        )
    
    return updated_order

async def hold_order(db: Prisma, order_id: str):
    order = await get_by_id(db, order_id)
    if not order: return None

    if order.status == OrderStatus.ON_HOLD:
        return order

    async with db.tx() as transaction:
        # Release stock
        if order.status == OrderStatus.READY_TO_SHIP:
            for item in order.lineItems:
                await transaction.product.update(
                    where={'id': item.productId},
                    data={'quantityInStock': {'increment': item.quantity}}
                )

        updated_order = await transaction.order.update(
            where={'id': order_id},
            data={'status': OrderStatus.ON_HOLD},
            include={'lineItems': {'include': {'product': True}}}
        )
        
    return updated_order

async def resume_order(db: Prisma, order_id: str):
    order = await get_by_id(db, order_id)
    if not order: return None

    if order.status != OrderStatus.ON_HOLD:
        raise ValueError("Only orders On Hold can be resumed.")

    async with db.tx() as transaction:
        # 1. Check & Deduct Stock
        for item in order.lineItems:
            product = await transaction.product.find_unique(where={'id': item.productId})
            if product.quantityInStock < item.quantity:
                raise ValueError(f"Cannot resume. Insufficient stock for {product.name}")
            
            await transaction.product.update(
                where={'id': item.productId},
                data={'quantityInStock': {'decrement': item.quantity}}
            )

        # 2. Update Status
        updated_order = await transaction.order.update(
            where={'id': order_id},
            data={'status': OrderStatus.READY_TO_SHIP},
            include={'lineItems': {'include': {'product': True}}}
        )

    return updated_order