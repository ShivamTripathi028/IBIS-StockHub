from prisma import Prisma

async def get_all_inventory_items(db: Prisma, search_query: str | None = None):
    """
    Smart Inventory Fetch:
    - If 'search_query' is provided: Search ALL products (Name/SKU), ignoring stock level.
    - If NO search: Return only products with Stock > 0 (Clean Dashboard).
    """
    if search_query:
        return await db.product.find_many(
            where={
                'OR': [
                    {'name': {'contains': search_query, 'mode': 'insensitive'}},
                    {'sku': {'contains': search_query, 'mode': 'insensitive'}}
                ]
            },
            order={'quantityInStock': 'desc'},
            take=50 # Limit results for performance
        )
    
    # Default view: Only active stock
    return await db.product.find_many(
        where={
            'quantityInStock': {'gt': 0}
        },
        order={'name': 'asc'}
    )

async def reset_inventory(db: Prisma):
    """
    Resets quantityInStock to 0 for ALL products.
    """
    return await db.product.update_many(
        where={}, 
        data={'quantityInStock': 0}
    )