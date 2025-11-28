from prisma import Prisma

async def get_all_inventory_items(db: Prisma):
    """
    Returns only products that have positive stock (quantity > 0).
    Items with 0 stock are filtered out at the database level for performance.
    """
    return await db.product.find_many(
        where={
            'quantityInStock': {
                'gt': 0  # Only fetch items greater than 0
            }
        },
        order={'name': 'asc'}
    )