from prisma import Prisma
from prisma.enums import ShipmentStatus, OrderStatus

async def get_stats(db: Prisma):
    # 1. Product Stats
    total_skus = await db.product.count(
        where={'quantityInStock': {'gt': 0}}
    )
    
    # 2. Total Inventory Units
    result = await db.query_raw('SELECT SUM(quantity_in_stock) as total FROM "Product"')
    total_units = int(result[0]['total']) if result and result[0]['total'] is not None else 0

    # 3. Low Stock 
    low_stock_count = await db.product.count(
        where={
            'quantityInStock': {
                'gt': 0,  
                'lte': 5  
            }
        }
    )

    # 4. Shipment Stats
    pending_shipments = await db.shipment.count(
        where={'status': {'in': [ShipmentStatus.PLANNING, ShipmentStatus.ORDERED]}}
    )

    # 5. Order Stats [UPDATED]
    orders_ready = await db.order.count(
        where={'status': OrderStatus.READY_TO_SHIP}
    )
    
    orders_waiting = await db.order.count(
        where={'status': OrderStatus.AWAITING_STOCK}
    )

    return {
        'total_skus': total_skus,
        'total_units': total_units,
        'low_stock_count': low_stock_count,
        'pending_shipments': pending_shipments,
        'orders_ready': orders_ready,      # New
        'orders_waiting': orders_waiting   # New
    }

async def get_low_stock_items(db: Prisma):
    """
    Get top 5 items running low.
    """
    products = await db.product.find_many(
        where={
            'quantityInStock': {
                'gt': 0, 
                'lte': 5
            }
        },
        order={'quantityInStock': 'asc'},
        take=5
    )
    
    return [
        {
            'id': p.id,
            'name': p.name,
            'sku': p.sku,
            'quantity': p.quantityInStock
        }
        for p in products
    ]