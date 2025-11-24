from prisma import Prisma
from prisma.enums import OrderStatus
from .schemas import OrderCreate

async def get_all(db: Prisma, status: OrderStatus | None = None):
    """
    Returns all orders, with an optional filter for status.
    """
    query = {}
    if status:
        query['where'] = {'status': status}
    
    return await db.order.find_many(
        include={
            'lineItems': {
                'include': {
                    'product': True
                }
            }
        },
        order={'createdAt': 'desc'},
        **query
    )

async def get_by_id(db: Prisma, order_id: str):
    """Returns a single order by its ID, including its line items and products."""
    return await db.order.find_unique(
        where={'id': order_id},
        include={'lineItems': {'include': {'product': True}}}
    )

async def create(db: Prisma, order_data: OrderCreate):
    async with db.tx() as transaction:
        can_fulfill_all = True
        for item in order_data.line_items:
            product = await transaction.product.find_unique(where={'id': item.product_id})
            if not product or product.quantityInStock < item.quantity:
                can_fulfill_all = False
                break
        initial_status = OrderStatus.READY_TO_SHIP if can_fulfill_all else OrderStatus.AWAITING_STOCK
        new_order = await transaction.order.create(
            data={
                'customerName': order_data.customer_name,
                'source': order_data.source,
                'status': initial_status
            }
        )
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
    """
    Marks an order as COMPLETED and decrements stock for all items in the order.
    This is an atomic operation.
    """
    order_to_complete = await get_by_id(db, order_id)
    if not order_to_complete:
        return None # Order not found

    # You can only complete an order that is ready to ship
    if order_to_complete.status != OrderStatus.READY_TO_SHIP:
        raise ValueError("Order is not in a state that can be completed.")

    async with db.tx() as transaction:
        # 1. Decrement stock for each product in the order
        for item in order_to_complete.lineItems:
            await transaction.product.update(
                where={'id': item.productId},
                data={'quantityInStock': {'decrement': item.quantity}}
            )
        
        # 2. Update the order status
        await transaction.order.update(
            where={'id': order_id},
            data={'status': OrderStatus.COMPLETED}
        )
    
    return await get_by_id(db, order_id)

async def cancel_order(db: Prisma, order_id: str):
    """Marks an order as CANCELLED."""
    # Note: In a real-world scenario, you might add logic here to return items to stock
    # if the order was already in 'READY_TO_SHIP' status. For now, we keep it simple.
    return await db.order.update(
        where={'id': order_id},
        data={'status': OrderStatus.CANCELLED},
        include={'lineItems': {'include': {'product': True}}}
    )

async def hold_order(db: Prisma, order_id: str):
    """Marks an order as ON_HOLD."""
    return await db.order.update(
        where={'id': order_id},
        data={'status': OrderStatus.ON_HOLD},
        include={'lineItems': {'include': {'product': True}}}
    )