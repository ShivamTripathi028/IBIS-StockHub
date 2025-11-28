from prisma import Prisma
from .schemas import ProductCreate

# --- UPDATED FUNCTION ---
async def get_all(db: Prisma, search_query: str | None = None):
    """
    Returns products. If search_query is provided, filters by SKU or Name.
    """
    if search_query:
        # Prisma 'OR' operator allows searching multiple fields
        return await db.product.find_many(
            where={
                'OR': [
                    {
                        'name': {
                            'contains': search_query,
                            'mode': 'insensitive' # Case-insensitive search
                        }
                    },
                    {
                        'sku': {
                            'contains': search_query,
                            'mode': 'insensitive'
                        }
                    }
                ]
            },
            take=20 # Limit results to keep the dropdown snappy
        )
    
    # If no search query, return all (or first 100 to avoid huge payloads)
    return await db.product.find_many(take=100)

async def create(db: Prisma, product_data: ProductCreate):
    """Creates a new product in the database."""
    return await db.product.create(data=product_data.model_dump())

async def get_by_sku(db: Prisma, sku: str):
    """Finds a product by its unique SKU."""
    return await db.product.find_unique(where={'sku': sku})