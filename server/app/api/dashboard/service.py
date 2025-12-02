from prisma import Prisma
from prisma.enums import ShipmentStatus, OrderStatus

async def get_stats(db: Prisma):
    # 1. Product Stats
    # count() is optimized by Prisma to use SELECT COUNT(*)
    total_skus = await db.product.count()
    
    # 2. Total Inventory Units - PERFORMANCE FIX
    # Instead of fetching all rows, we ask the DB to sum the column.
    # We use query_raw because the generated 'aggregate' method was causing issues for you.
    # Note: We query the actual table name "Product" and column "quantity_in_stock"
    result = await db.query_raw('SELECT SUM(quantity_in_stock) as total FROM "Product"')
    
    # Handle case where result is None (empty DB)
    total_units = int(result[0]['total']) if result and result[0]['total'] is not None else 0

    # 3. Low Stock - LOGIC FIX
    # Only count items that are actually in stock (gt: 0) but running low (lte: 5).
    # This ignores the 0-stock catalog items.
    low_stock_count = await db.product.count(
        where={
            'quantityInStock': {
                'gt': 0,  # Greater than 0
                'lte': 5  # Less than or equal to 5
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
    Same logic: exclude 0 stock items from this specific list.
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