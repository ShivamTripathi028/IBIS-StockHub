from prisma import Prisma

async def get_all_inventory_items(db: Prisma):
    """
    Returns all products to serve as the inventory list.
    The inventory is derived directly from the quantityInStock of each product.
    """
    return await db.product.find_many(
        order={'name': 'asc'} # Order alphabetically by name for a clean default view
    )