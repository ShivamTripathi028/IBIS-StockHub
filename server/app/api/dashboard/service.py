from prisma import Prisma
from prisma.enums import ShipmentStatus, OrderStatus

async def get_stats(db: Prisma):
    # 1. Product Stats - UPDATED
    # Only count SKUs that have physical stock (quantity > 0)
    total_skus = await db.product.count(
        where={'quantityInStock': {'gt': 0}}
    )
    
    # 2. Total Inventory Units
    # We use query_raw for performance on the sum operation
    result = await db.query_raw('SELECT SUM(quantity_in_stock) as total FROM "Product"')
    
    # Handle case where result is None (empty DB)
    total_units = int(result[0]['total']) if result and result[0]['total'] is not None else 0

    # 3. Low Stock 
    # Only count items that are actually in stock (gt: 0) but running low (lte: 5).
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

    # 5. Order Stats
    active_orders = await db.order.count(
        where={'status': {'in': [OrderStatus.AWAITING_STOCK, OrderStatus.READY_TO_SHIP]}}
    )

    return {
        'total_skus': total_skus,
        'total_units': total_units,
        'low_stock_count': low_stock_count,
        'pending_shipments': pending_shipments,
        'active_orders': active_orders
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